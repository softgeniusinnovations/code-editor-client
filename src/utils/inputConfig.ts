import { InputField } from "@/types/run"

export const getInputFieldsForLanguage = (languageName: string, code: string): InputField[] => {
    const hasFileOperations = checkForFileOperations(code)

    if (languageName.toLowerCase() === "python" && hasFileOperations) {
        const pythonFileFields: InputField[] = [
            {
                id: "data_file",
                label: "Data File (CSV/JSON/TXT/XML/XLSX)",
                type: "file",
                required: false,
                accept: ".csv,.json,.txt,.xml,.xlsx,.xls,.db,.sqlite,.sqlite3,.mdb"
            }
        ]
        return pythonFileFields
    }

    return []
}

export const hasVisualizationSupport = (code: string): boolean => {
    const visualizationKeywords = [
        'matplotlib', 'plt.', 'plot(', 'show()', 'seaborn', 'sns.',
        'plotly', 'ggplot', 'bokeh', 'altair', 'pygal',
        'hist(', 'scatter(', 'bar(', 'pie(', 'imshow(', 'figure(',
        'subplot', 'title(', 'xlabel(', 'ylabel(', 'legend(',

        'chart.js', 'plotly.js', 'd3.', 'canvas', 'svg',

        'visualization', 'graph', 'chart', 'plot'
    ]

    const lowerCode = code.toLowerCase()
    
    return visualizationKeywords.some(keyword => 
        lowerCode.includes(keyword.toLowerCase())
    )
}

export const hasVisualizationOutput = (output: string): boolean => {
    const visualIndicators = [
        'figure',
        'plot',
        'chart',
        'graph',
        'visualization',
        'matplotlib',
        'seaborn',
        'plotly',
        'bokeh',
        'data:image',
        'base64'
    ]

    const lowerOutput = output.toLowerCase()
    return visualIndicators.some(indicator => lowerOutput.includes(indicator))
}

const checkForFileOperations = (code: string): boolean => {
    const fileKeywords = [
        'open(', 'with open', 'read(', 'readline(', 'readlines(',
        'write(', 'writelines(', 'load(', 'loadtxt(', 'genfromtxt(',
        'read_csv', 'read_excel', 'read_json', 'read_sql',
        'pd.read_csv', 'pd.read_excel', 'pd.read_json',
        'csv.reader', 'csv.writer', 'json.load', 'json.dump',
        'pickle.load', 'pickle.dump', 'sqlite3.connect'
    ]

    const lowerCode = code.toLowerCase()
    return fileKeywords.some(keyword => lowerCode.includes(keyword.toLowerCase()))
}

export const requiresInputCollection = (languageName: string, code: string): boolean => {
    const inputFields = getInputFieldsForLanguage(languageName, code)
    return inputFields.length > 0
}