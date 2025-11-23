// components/InputCollector.tsx
import { useRunCode } from "@/context/RunCodeContext"
import { useFileSystem } from "@/context/FileContext"
import { CollectedInputs } from "@/types/run"
import { getInputFieldsForLanguage } from "@/utils/inputConfig"
import { ChangeEvent } from "react"
import { LuX, LuUpload } from "react-icons/lu"

function InputCollector() {
    const {
        selectedLanguage,
        showInputCollector,
        setShowInputCollector,
        collectedInputs,
        setCollectedInputs,
        submitCollectedInputs,
    } = useRunCode()

    const { activeFile } = useFileSystem()

    if (!activeFile?.content) return null

    const inputFields = getInputFieldsForLanguage(selectedLanguage.language, activeFile.content)

    const handleFileInputChange = (fieldId: string, file: File | null) => {
        setCollectedInputs((prev: CollectedInputs) => ({
            ...prev,
            fileInputs: {
                ...prev.fileInputs,
                [fieldId]: file
            }
        }))
    }

    const getFileName = (file: File | null): string => {
        return file ? file.name : 'No file chosen'
    }

    if (!showInputCollector) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-2xl rounded-lg bg-darkHover p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                        Provide Inputs for {selectedLanguage.language}
                    </h2>
                    <button
                        onClick={() => setShowInputCollector(false)}
                        className="rounded-full p-1 text-white hover:bg-gray-700"
                    >
                        <LuX size={24} />
                    </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {inputFields.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No additional inputs required for this code.</p>
                    ) : (
                        inputFields.map((field) => (
                            <div key={field.id} className="space-y-2">
                                <label className="block text-sm font-medium text-white">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                
                                {field.type === 'file' ? (
                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept={field.accept}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => 
                                                handleFileInputChange(field.id, e.target.files?.[0] || null)
                                            }
                                            className="hidden"
                                            id={`file-${field.id}`}
                                        />
                                        <label
                                            htmlFor={`file-${field.id}`}
                                            className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-600 bg-darkHover px-3 py-3 text-white transition-colors hover:border-primary hover:bg-gray-800"
                                        >
                                            <LuUpload size={20} />
                                            <span className="flex-1">
                                                {getFileName(collectedInputs.fileInputs[field.id])}
                                            </span>
                                            <span className="text-sm text-primary">Choose File</span>
                                        </label>
                                        {field.accept && (
                                            <p className="text-xs text-gray-400">
                                                Supported: {field.accept}
                                            </p>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={() => setShowInputCollector(false)}
                        className="rounded-md bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submitCollectedInputs}
                        disabled={inputFields.length === 0}
                        className="rounded-md bg-primary px-4 py-2 font-bold text-black transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit & Run Code
                    </button>
                </div>
            </div>
        </div>
    )
}

export default InputCollector