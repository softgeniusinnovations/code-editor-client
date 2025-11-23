import { useCopilot } from "@/context/CopilotContext"
import { useFileSystem } from "@/context/FileContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { SocketEvent } from "@/types/socket"
import { useState } from "react"
import toast from "react-hot-toast"
import { LuClipboardPaste, LuCopy, LuRepeat } from "react-icons/lu"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { askGemini } from "@/api/gemini"
import { generateWithGPT as generateWithGPTAPI } from "@/api/chatgpt"
import { generateWithDeepSeek as generateWithDeepSeekAPI } from "@/api/deepseek"

type TabType = 'gemini' | 'chatgpt' | 'deepseek' | 'copilot'

function CopilotView() {
    const {socket} = useSocket()
    const { viewHeight } = useResponsive()
    const { generateCode, output, isRunning, setInput } = useCopilot()
    const { activeFile, updateFileContent, setActiveFile } = useFileSystem()
    const [activeTab, setActiveTab] = useState<TabType>('gemini')
    const [geminiInput, setGeminiInput] = useState('')
    const [geminiOutput, setGeminiOutput] = useState('')
    const [isGeminiLoading, setIsGeminiLoading] = useState(false)
    const [chatgptInput, setChatgptInput] = useState('')
    const [chatgptOutput, setChatgptOutput] = useState('')
    const [isChatgptLoading, setIsChatgptLoading] = useState(false)
    const [deepseekInput, setDeepseekInput] = useState('')
    const [deepseekOutput, setDeepseekOutput] = useState('')
    const [isDeepseekLoading, setIsDeepseekLoading] = useState(false)

    // Gemini Functions
    const generateWithGemini = async () => {
        if (!geminiInput.trim()) {
            toast.error("Please enter a prompt for Gemini")
            return
        }

        setIsGeminiLoading(true)
        try {
            const response = await askGemini(geminiInput)
            setGeminiOutput(response)
            toast.success("Gemini response generated!")
        } catch (error) {
            console.error("Error generating with Gemini:", error)
            toast.error("Failed to generate code with Gemini")
            setGeminiOutput("Error: Unable to generate code. Please try again.")
        } finally {
            setIsGeminiLoading(false)
        }
    }

    // ChatGPT Functions
    const generateWithChatGPT = async () => {
        if (!chatgptInput.trim()) {
            toast.error("Please enter a prompt for ChatGPT")
            return
        }

        setIsChatgptLoading(true)
        try {
            const response = await generateWithGPTAPI(chatgptInput)
            setChatgptOutput(response)
            toast.success("ChatGPT response generated!")
        } catch (error) {
            console.error("Error generating with ChatGPT:", error)
            toast.error("Failed to generate code with ChatGPT")
            setChatgptOutput("Error: Unable to generate code. Please try again.")
        } finally {
            setIsChatgptLoading(false)
        }
    }

    // DeepSeek Functions
    const generateWithDeepSeek = async () => {
        if (!deepseekInput.trim()) {
            toast.error("Please enter a prompt for DeepSeek")
            return
        }

        setIsDeepseekLoading(true)
        try {
            const response = await generateWithDeepSeekAPI(deepseekInput)
            setDeepseekOutput(response)
            toast.success("DeepSeek response generated!")
        } catch (error) {
            console.error("Error generating with DeepSeek:", error)
            toast.error("Failed to generate code with DeepSeek")
            setDeepseekOutput("Error: Unable to generate code. Please try again.")
        } finally {
            setIsDeepseekLoading(false)
        }
    }

    // Common Functions
    const copyOutput = async (content: string) => {
        try {
            const cleanedContent = content.replace(/```[\w]*\n?/g, "").trim()
            await navigator.clipboard.writeText(cleanedContent)
            toast.success("Output copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy output to clipboard")
            console.log(error)
        }
    }

    const pasteCodeInFile = (content: string) => {
        if (activeFile) {
            const fileContent = activeFile.content
                ? `${activeFile.content}\n`
                : ""
            const cleanedContent = `${fileContent}${content.replace(/```[\w]*\n?/g, "").trim()}`
            updateFileContent(activeFile.id, cleanedContent)
            setActiveFile({ ...activeFile, content: cleanedContent })
            toast.success("Code pasted successfully")
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: cleanedContent,
            })
        }
    }

    const replaceCodeInFile = (content: string) => {
        if (activeFile) {
            const isConfirmed = confirm(
                `Are you sure you want to replace the code in the file?`,
            )
            if (!isConfirmed) return
            const cleanedContent = content.replace(/```[\w]*\n?/g, "").trim()
            updateFileContent(activeFile.id, cleanedContent)
            setActiveFile({ ...activeFile, content: cleanedContent })
            toast.success("Code replaced successfully")
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: cleanedContent,
            })
        }
    }

    // Helper functions to get current state
    const getCurrentOutput = () => {
        switch (activeTab) {
            case 'gemini': return geminiOutput
            case 'chatgpt': return chatgptOutput
            case 'deepseek': return deepseekOutput
            case 'copilot': return output
            default: return ''
        }
    }

    const getCurrentLoading = () => {
        switch (activeTab) {
            case 'gemini': return isGeminiLoading
            case 'chatgpt': return isChatgptLoading
            case 'deepseek': return isDeepseekLoading
            case 'copilot': return isRunning
            default: return false
        }
    }

    const getCurrentInput = () => {
        switch (activeTab) {
            case 'gemini': return geminiInput
            case 'chatgpt': return chatgptInput
            case 'deepseek': return deepseekInput
            case 'copilot': return ''
            default: return ''
        }
    }

    const setCurrentInput = (value: string) => {
        switch (activeTab) {
            case 'gemini': setGeminiInput(value); break
            case 'chatgpt': setChatgptInput(value); break
            case 'deepseek': setDeepseekInput(value); break
            case 'copilot': setInput(value); break
        }
    }

    const handleGenerate = () => {
        switch (activeTab) {
            case 'gemini': generateWithGemini(); break
            case 'chatgpt': generateWithChatGPT(); break
            case 'deepseek': generateWithDeepSeek(); break
            case 'copilot': generateCode(); break
        }
    }

    const getButtonText = () => {
        const baseText = {
            'gemini': 'Generate with Gemini',
            'chatgpt': 'Generate with ChatGPT',
            'deepseek': 'Generate with DeepSeek',
            'copilot': 'Generate Code'
        }[activeTab]

        return getCurrentLoading() ? `Generating with ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}...` : baseText
    }

    const getButtonColor = () => {
        switch (activeTab) {
            case 'gemini': return 'bg-blue-600'
            case 'chatgpt': return 'bg-green-600'
            case 'deepseek': return 'bg-purple-600'
            case 'copilot': return 'bg-primary'
        }
    }

    const renderActionButtons = (content: string) => {
        if (!content) return null

        return (
            <div className="flex justify-end gap-4 pt-2">
                <button 
                    title="Copy Output" 
                    onClick={() => copyOutput(content)}
                    className="p-1 rounded hover:bg-darkHover transition-colors"
                >
                    <LuCopy size={18} className="text-white" />
                </button>
                <button
                    title="Replace code in file"
                    onClick={() => replaceCodeInFile(content)}
                    className="p-1 rounded hover:bg-darkHover transition-colors"
                >
                    <LuRepeat size={18} className="text-white" />
                </button>
                <button
                    title="Paste code in file"
                    onClick={() => pasteCodeInFile(content)}
                    className="p-1 rounded hover:bg-darkHover transition-colors"
                >
                    <LuClipboardPaste size={18} className="text-white" />
                </button>
            </div>
        )
    }

    const getPlaceholderText = () => {
        switch (activeTab) {
            case 'gemini': return "Ask Gemini to generate code..."
            case 'chatgpt': return "Ask ChatGPT to generate code..."
            case 'deepseek': return "Ask DeepSeek to generate code..."
            case 'copilot': return "What code do you want to generate?"
            default: return "Enter your prompt..."
        }
    }

    return (
        <div
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">AI Assistant</h1>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-600 gap-1">
                {(['gemini', 'chatgpt', 'deepseek', 'copilot'] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        className={`px-4 py-2 font-medium transition-colors rounded-t-md capitalize ${
                            activeTab === tab 
                                ? `border-b-2 ${
                                    tab === 'gemini' ? 'border-blue-500 text-blue-500' :
                                    tab === 'chatgpt' ? 'border-green-500 text-green-500' :
                                    tab === 'deepseek' ? 'border-purple-500 text-purple-500' :
                                    'border-primary text-primary'
                                }` 
                                : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'chatgpt' ? 'ChatGPT' : 
                         tab === 'deepseek' ? 'DeepSeek' : 
                         tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <textarea
                className="min-h-[120px] w-full rounded-md border-none bg-darkHover p-2 text-white outline-none"
                placeholder={getPlaceholderText()}
                value={getCurrentInput()}
                onChange={(e) => {
                    setCurrentInput(e.target.value)
                }}
            />
            
            <button
                className={`mt-1 flex w-full justify-center rounded-md p-2 font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${getButtonColor()}`}
                onClick={handleGenerate}
                disabled={getCurrentLoading()}
            >
                {getButtonText()}
            </button>

            {/* Output Actions */}
            {renderActionButtons(getCurrentOutput())}

            {/* Output Display */}
            <div className="h-full rounded-lg w-full overflow-y-auto p-0">
                <ReactMarkdown
                    components={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        code({ inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "")
                            const language = match ? match[1] : "javascript"

                            return !inline ? (
                                <SyntaxHighlighter
                                    style={dracula}
                                    language={language}
                                    PreTag="pre"
                                    className="!m-0 !h-full !rounded-lg !bg-gray-900 !p-2"
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        pre({ children }) {
                            return <pre className="h-full">{children}</pre>
                        },
                    }}
                >
                    {getCurrentLoading() ? "Generating code..." : getCurrentOutput() || "Your generated code will appear here..."}
                </ReactMarkdown>
            </div>
        </div>
    )
}

export default CopilotView