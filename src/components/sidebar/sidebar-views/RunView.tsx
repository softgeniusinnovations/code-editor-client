import { useRunCode } from "@/context/RunCodeContext"
import useResponsive from "@/hooks/useResponsive"
import { ChangeEvent, useState } from "react"
import toast from "react-hot-toast"
import { LuCopy, LuX, LuEye, LuChartBar, LuRefreshCw } from "react-icons/lu"
import { PiCaretDownBold } from "react-icons/pi"
import InputCollector from "../../InputCollector"

function RunView() {
    const { viewHeight } = useResponsive()
    const {
        setInput,
        output,
        isRunning,
        supportedLanguages,
        selectedLanguage,
        setSelectedLanguage,
        runCode,
        hasVisualization,
        showVisualization
    } = useRunCode()

    const [showOutputPopup, setShowOutputPopup] = useState(false)

    const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const lang = JSON.parse(e.target.value)
        setSelectedLanguage(lang)
    }

    // Filter out base64 image data from output
    const filterOutput = (text: string) => {
        return text.replace(/\s*data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '')
                  .replace(/\s*data:image\/png;[^\n]*/g, '')
                  .trim();
    }

    const copyOutput = () => {
        navigator.clipboard.writeText(filterOutput(output))
        toast.success("Output copied to clipboard")
    }

    const handleRunCode = async () => {
        setShowOutputPopup(true)
        await runCode()
    }

    const handleReRunCode = async () => {
        await runCode()
    }

    const displayOutput = filterOutput(output);

    return (
        <>
            <div
                className="flex flex-col items-center gap-2 p-4"
                style={{ height: viewHeight }}
            >
                <h1 className="view-title">Run Code</h1>
                <div className="flex h-[90%] w-full flex-col items-end gap-2 md:h-[92%]">
                    <div className="relative w-full">
                        <select
                            className="w-full rounded-md border-none bg-darkHover px-4 py-2 text-white outline-none"
                            value={JSON.stringify(selectedLanguage)}
                            onChange={handleLanguageChange}
                        >
                            {supportedLanguages
                                .sort((a, b) => (a.language > b.language ? 1 : -1))
                                .map((lang, i) => {
                                    return (
                                        <option
                                            key={i}
                                            value={JSON.stringify(lang)}
                                        >
                                            {lang.language +
                                                (lang.version
                                                    ? ` (${lang.version})`
                                                    : "")}
                                        </option>
                                    )
                                })}
                        </select>
                        <PiCaretDownBold
                            size={16}
                            className="absolute bottom-3 right-4 z-10 text-white"
                        />
                    </div>
                    <textarea
                        className="min-h-[120px] w-full resize-none rounded-md border-none bg-darkHover p-2 text-white outline-none"
                        placeholder="Write your input here..."
                        onChange={(e) => setInput(e.target.value)}
                    />
                    
                    {/* Run and Re-run Buttons */}
                    <div className="flex w-full gap-2">
                        <button
                            className="flex flex-1 justify-center rounded-md bg-primary p-2 font-bold text-black outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleRunCode}
                            disabled={isRunning}
                        >
                            {isRunning ? "Running..." : "Run"}
                        </button>
                    </div>
                    
                    <div className="flex w-full items-center justify-between">
                        <label>Output :</label>
                        <div className="flex gap-2">
                            {hasVisualization && (
                                <button 
                                    onClick={showVisualization}
                                    className="flex items-center gap-1 p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                    title="Show Visualization"
                                >
                                    <LuChartBar size={18} />
                                </button>
                            )}
                            {displayOutput && (
                                <button 
                                    onClick={() => setShowOutputPopup(true)}
                                    className="flex items-center gap-1 p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                                    title="Open Output in Popup"
                                >
                                    <LuEye size={18} />
                                </button>
                            )}
                            {displayOutput && (
                                <button 
                                    onClick={copyOutput} 
                                    className="flex items-center gap-1 p-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                    title="Copy Output"
                                >
                                    <LuCopy size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="w-full flex-grow resize-none overflow-y-auto rounded-md border-none bg-darkHover p-2 text-white outline-none">
                        <code>
                            <pre className="text-wrap">{displayOutput || "No output available"}</pre>
                        </code>
                    </div>
                </div>
            </div>

            {/* Input Collector Popup */}
            <InputCollector />

            {/* Output Popup */}
            {showOutputPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="relative w-full max-w-4xl rounded-lg bg-darkHover p-6 shadow-lg">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                {isRunning ? "Running Code..." : "Code Execution Result"}
                            </h2>
                            <button
                                onClick={() => setShowOutputPopup(false)}
                                className="rounded-full p-1 text-white hover:bg-gray-700"
                                disabled={isRunning}
                            >
                                <LuX size={24} />
                            </button>
                        </div>
                        
                        {isRunning ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                </div>
                                <p className="mt-4 text-lg text-white font-semibold">Executing your code...</p>
                                <p className="mt-2 text-sm text-gray-400">Please wait while we run your {selectedLanguage?.language} code</p>
                                
                                <div className="mt-6 flex space-x-2">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="max-h-[60vh] overflow-y-auto rounded-md bg-darkHover p-4">
                                    <code>
                                        <pre className="whitespace-pre-wrap break-words text-white">
                                            {displayOutput || "No output available"}
                                        </pre>
                                    </code>
                                </div>
                                
                                <div className="mt-4 flex justify-between items-center">
                                    <div className="flex gap-2">
                                        {hasVisualization && (
                                            <button
                                                onClick={showVisualization}
                                                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                                                title="Show Visualization"
                                            >
                                                <LuChartBar size={18} />
                                                <span>Visualization</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReRunCode}
                                            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                                            title="Run again with same inputs"
                                        >
                                            <LuRefreshCw size={16} />
                                            Re-run
                                        </button>
                                        <button
                                            onClick={copyOutput}
                                            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-bold text-black transition-colors hover:bg-primary/90"
                                        >
                                            <LuCopy size={16} />
                                            Copy Output
                                        </button>
                                        <button
                                            onClick={() => setShowOutputPopup(false)}
                                            className="rounded-md bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

export default RunView