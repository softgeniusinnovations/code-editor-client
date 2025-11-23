interface Language {
    language: string
    version: string
    aliases: string[]
}

interface RunContext {
    setInput: (input: string) => void
    output: string
    isRunning: boolean
    supportedLanguages: Language[]
    selectedLanguage: Language
    setSelectedLanguage: (language: Language) => void
    runCode: () => void
    hasVisualization: boolean
    showVisualization: () => void
    showInputCollector: boolean
    setShowInputCollector: (show: boolean) => void
    collectedInputs: CollectedInputs
     setCollectedInputs: (inputs: CollectedInputs | ((prev: CollectedInputs) => CollectedInputs)) => void
    submitCollectedInputs: () => void
    executeCode: () => void
}

interface CollectedInputs {
    textInputs: { [key: string]: string }
    fileInputs: { [key: string]: File | null }
}

interface InputField {
    id: string
    label: string
    type: 'text' | 'number' | 'file'
    required: boolean
    accept?: string
}

export { Language, RunContext, CollectedInputs, InputField }
