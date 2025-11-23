import axiosInstance from "@/api/pistonApi"
import codeeditorcloudInstance from "@/api/codeeditorcloud"
import { Language, RunContext as RunContextType, CollectedInputs } from "@/types/run"
import { hasVisualizationSupport, requiresInputCollection, hasVisualizationOutput } from "@/utils/inputConfig"
import langMap from "lang-map"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useFileSystem } from "./FileContext"

const RunCodeContext = createContext<RunContextType | null>(null)

export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const RunCodeContextProvider = ({ children }: { children: ReactNode }) => {
    const { activeFile } = useFileSystem()
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<Language>({
        language: "",
        version: "",
        aliases: [],
    })
    const [hasVisualization, setHasVisualization] = useState<boolean>(false)
    const [showInputCollector, setShowInputCollector] = useState<boolean>(false)
    const [collectedInputs, setCollectedInputs] = useState<CollectedInputs>({
        textInputs: {},
        fileInputs: {}
    })

    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const languages = await axiosInstance.get("/runtimes")
                setSupportedLanguages(languages.data)
            } catch (error: any) {
                toast.error("Failed to fetch supported languages")
                if (error?.response?.data) console.error(error?.response?.data)
            }
        }

        fetchSupportedLanguages()
    }, [])

    useEffect(() => {
        if (supportedLanguages.length === 0 || !activeFile?.name) return

        const extension = activeFile.name.split(".").pop()
        if (extension) {
            const languageName = langMap.languages(extension)
            const language = supportedLanguages.find(
                (lang) =>
                    lang.aliases.includes(extension) ||
                    languageName.includes(lang.language.toLowerCase()),
            )
            if (language) setSelectedLanguage(language)
        } else setSelectedLanguage({ language: "", version: "", aliases: [] })
    }, [activeFile?.name, supportedLanguages])

    useEffect(() => {
        if (activeFile?.content && selectedLanguage.language) {
            const hasViz = hasVisualizationSupport(activeFile.content)
            setHasVisualization(hasViz)
        } else {
            setHasVisualization(false)
        }
    }, [activeFile?.content, selectedLanguage.language])

    const showVisualization = () => {
        // Check if output contains visualization data
        const hasVisualOutput = hasVisualizationOutput(output)

        if (hasVisualOutput) {
            const vizWindow = window.open('', '_blank')
            if (vizWindow) {
                // Check if output contains base64 image
                const base64Match = output.match(/data:image\/[^;]+;base64,([^"'\s]+)/)
                
                vizWindow.document.write(`
                    <html>
                        <head>
                            <title>Code Visualization - ${selectedLanguage.language}</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    margin: 20px; 
                                    background: #1e1e1e; 
                                    color: white;
                                }
                                .container { max-width: 1200px; margin: 0 auto; }
                                .output { 
                                    background: #2d2d2d; 
                                    padding: 20px; 
                                    border-radius: 8px; 
                                    margin-top: 20px;
                                    white-space: pre-wrap;
                                }
                                .info-box {
                                    background: #3a3a3a;
                                    padding: 15px;
                                    border-radius: 8px;
                                    margin-bottom: 20px;
                                    border-left: 4px solid #007acc;
                                }
                                .image-container { 
                                    text-align: center; 
                                    margin: 20px 0; 
                                    background: white;
                                    padding: 20px;
                                    border-radius: 8px;
                                }
                                .image-container img { 
                                    max-width: 100%; 
                                    height: auto;
                                    border: 1px solid #ddd;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>Code Visualization - ${selectedLanguage.language}</h1>
                                ${base64Match ? 
                                    `<div class="image-container">
                                        <img src="data:image/png;base64,${base64Match[1]}" alt="Generated Plot" />
                                    </div>` : 
                                    `<div class="info-box">
                                        <strong>Visualization Output Detected</strong><br/>
                                        Your code contains visualization commands. The output below may contain plot data or instructions.
                                    </div>
                                    <div class="output">${output}</div>`
                                }
                            </div>
                        </body>
                    </html>
                `)
                vizWindow.document.close()
            }
        } else {
            toast.error("No visualization output found. Make sure your code generates plot data.")
        }
    }

    const submitCollectedInputs = () => {
        const combinedInput = Object.values(collectedInputs.textInputs).join('\n')
        setInput(combinedInput)
        
        setShowInputCollector(false)
        toast.success("Inputs collected successfully")
        
        executeCode()
    }

    const executeCode = async () => {
        if (!activeFile) {
            toast.error("No active file to execute")
            return
        }

        setIsRunning(true)
        toast.loading("Running code...")

        try {
            if (selectedLanguage.language === "python" && Object.keys(collectedInputs.fileInputs).length > 0) {
                const formData = new FormData()
                formData.append('code', activeFile.content || '')
                formData.append('language', 'python')
                formData.append('input', input || '')

                Object.entries(collectedInputs.fileInputs).forEach(([key, file]) => {
                    if (file) {
                        formData.append(key, file)
                    }
                })

                const response = await codeeditorcloudInstance.post("/execute.php", formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })

                if (response.data.success) {
                    setOutput(response.data.output)
                } else {
                    setOutput(response.data.error || "Execution failed")
                }
            }
            else if (selectedLanguage.language === "python" || selectedLanguage.aliases.includes("py")) {
                try {
                    const response = await codeeditorcloudInstance.post("/execute.php", {
                        code: activeFile.content,
                        language: "python",
                        input: input
                    })

                    if (response.data.success) {
                        setOutput(response.data.output)
                    } else {
                        setOutput(response.data.error || "Execution failed")
                    }
                } catch (cloudError: any) {
                    console.warn("code-editor-cloud failed, falling back to piston API:", cloudError.message)
                    
                    const { language, version } = selectedLanguage
                    const response = await axiosInstance.post("/execute", {
                        language,
                        version,
                        files: [{ name: activeFile.name, content: activeFile.content }],
                        stdin: input,
                    })
                    
                    if (response.data.run.stderr) {
                        setOutput(response.data.run.stderr)
                    } else {
                        setOutput(response.data.run.stdout)
                    }
                }
            } else {
                const { language, version } = selectedLanguage
                const response = await axiosInstance.post("/execute", {
                    language,
                    version,
                    files: [{ name: activeFile.name, content: activeFile.content }],
                    stdin: input,
                })
                
                if (response.data.run.stderr) {
                    setOutput(response.data.run.stderr)
                } else {
                    setOutput(response.data.run.stdout)
                }
            }

            setIsRunning(false)
            toast.dismiss()
            toast.success("Code executed successfully")
        } catch (error: any) {
            console.error("Execution error:", error.response?.data || error.message)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to run the code")
        }
    }

    const runCode = async () => {
        try {
            if (!selectedLanguage.language) {
                return toast.error("Please select a language to run the code")
            } else if (!activeFile) {
                return toast.error("Please open a file to run the code")
            }

            // Check if we need to collect inputs
            const needsInput = requiresInputCollection(selectedLanguage.language, activeFile.content || '')
            
            if (needsInput) {
                setShowInputCollector(true)
                return
            }

            setIsRunning(true)
            await executeCode()
        } catch (error: any) {
            console.error("Execution error:", error.response?.data || error.message)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to run the code")
        }
    }

    return (
        <RunCodeContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                supportedLanguages,
                selectedLanguage,
                setSelectedLanguage,
                runCode,
                hasVisualization,
                showVisualization,
                showInputCollector,
                setShowInputCollector,
                collectedInputs,
                setCollectedInputs,
                submitCollectedInputs,
                executeCode,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }