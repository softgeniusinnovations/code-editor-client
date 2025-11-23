export interface ICopilotContext {
    setInput: (input: string) => void
    output: string
    input:string
    isRunning: boolean
    generateCode: () => void
}
