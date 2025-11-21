import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useSocket } from "@/context/SocketContext"
import usePageEvents from "@/hooks/usePageEvents"
import useResponsive from "@/hooks/useResponsive"
import { editorThemes } from "@/resources/Themes"
import { FileSystemItem } from "@/types/file"
import { SocketEvent } from "@/types/socket"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, {
    Extension,
    ViewUpdate,
    scrollPastEnd,
} from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import toast from "react-hot-toast"
import { collaborativeHighlighting, updateRemoteUsers } from "./collaborativeHighlighting"
import customMapping from "@/utils/customMapping"

// Import additional language packages for comprehensive support
import { javascript } from "@codemirror/lang-javascript"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { python } from "@codemirror/lang-python"
import { java } from "@codemirror/lang-java"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { xml } from "@codemirror/lang-xml"
import { yaml } from "@codemirror/lang-yaml"
import { sql } from "@codemirror/lang-sql"
import { php } from "@codemirror/lang-php"
import { rust } from "@codemirror/lang-rust"
import { go } from "@codemirror/lang-go"
import { cpp } from "@codemirror/lang-cpp"

function Editor() {
    const { users, currentUser } = useAppContext()
    const { activeFile, setActiveFile } = useFileSystem()
    const { theme, language, fontSize } = useSettings()
    const { socket } = useSocket()
    const { viewHeight } = useResponsive()
    const [timeOut, setTimeOut] = useState(setTimeout(() => {}, 0))
    const filteredUsers = useMemo(
        () => users.filter((u) => u.username !== currentUser.username),
        [users, currentUser],
    )
    const [extensions, setExtensions] = useState<Extension[]>([])
    const editorRef = useRef<any>(null)
    const [lastCursorPosition, setLastCursorPosition] = useState<number>(0)
    const [lastSelection, setLastSelection] = useState<{start?: number, end?: number}>({})
    const cursorMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Enhanced language mapping with fallback support
    const languageExtensions: { [key: string]: () => Extension } = {
        // Core web languages
        javascript: () => javascript({ jsx: true, typescript: false }),
        typescript: () => javascript({ jsx: true, typescript: true }),
        jsx: () => javascript({ jsx: true, typescript: false }),
        tsx: () => javascript({ jsx: true, typescript: true }),
        
        // HTML/CSS
        html: () => html(),
        css: () => css(),
        scss: () => css(),
        sass: () => css(),
        less: () => css(),
        
        // Backend languages
        python: () => python(),
        java: () => java(),
        php: () => php(),
        
        // System languages
        c: () => cpp(),
        cpp: () => cpp(),
        rust: () => rust(),
        go: () => go(),
        
        // Data formats
        json: () => json(),
        xml: () => xml(),
        yaml: () => yaml(),
        
        // Documentation
        markdown: () => markdown(),
        
        // Database
        sql: () => sql(),
        
        // Add more languages as needed...
    }

    // Function to detect language from file extension using customMapping
    const detectLanguageFromFile = useCallback((fileName: string): LanguageName | null => {
        if (!fileName) return null
        
        const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.') + 1)
        const mappedLanguage = customMapping[extension]
        
        return mappedLanguage as LanguageName || null
    }, [])

    // Function to normalize language name using customMapping
    const normalizeLanguage = useCallback((lang: string): LanguageName | null => {
        if (!lang) return null
        
        const normalized = lang.toLowerCase().trim()
        const mappedLanguage = customMapping[normalized]
        
        return mappedLanguage as LanguageName || null
    }, [])

    // Get the actual language to use for syntax highlighting
    const actualLanguage = useMemo((): LanguageName | null => {
        // First try to detect from file extension if we have an active file
        if (activeFile?.name) {
            const fileLang = detectLanguageFromFile(activeFile.name)
            if (fileLang) {
                return fileLang
            }
        }
        
        // Then try to normalize the user-selected language
        if (language) {
            const normalizedLang = normalizeLanguage(language)
            if (normalizedLang) {
                return normalizedLang
            }
        }
        
        return null
    }, [activeFile?.name, language, detectLanguageFromFile, normalizeLanguage])

    const onCodeChange = (code: string, view: ViewUpdate) => {
        if (!activeFile) return

        const file: FileSystemItem = { ...activeFile, content: code }
        setActiveFile(file)

        // Get cursor position and selection range
        const selection = view.state?.selection?.main
        const cursorPosition = selection?.head || 0
        const selectionStart = selection?.from
        const selectionEnd = selection?.to

        // Emit cursor and selection data
        socket.emit(SocketEvent.TYPING_START, {
            cursorPosition,
            selectionStart,
            selectionEnd
        })
        socket.emit(SocketEvent.FILE_UPDATED, {
            fileId: activeFile.id,
            newContent: code,
        })
        clearTimeout(timeOut)

        const newTimeOut = setTimeout(
            () => socket.emit(SocketEvent.TYPING_PAUSE),
            1000,
        )
        setTimeOut(newTimeOut)
    }

    // Handle cursor/selection changes without typing
    const handleSelectionChange = useCallback((view: ViewUpdate) => {
        if (!view.selectionSet) return

        const selection = view.state?.selection?.main
        const cursorPosition = selection?.head || 0
        const selectionStart = selection?.from
        const selectionEnd = selection?.to

        // Check if cursor or selection actually changed
        const cursorChanged = cursorPosition !== lastCursorPosition
        const selectionChanged = selectionStart !== lastSelection.start || selectionEnd !== lastSelection.end

        if (cursorChanged || selectionChanged) {
            setLastCursorPosition(cursorPosition)
            setLastSelection({ start: selectionStart, end: selectionEnd })

            // Clear existing timeout
            if (cursorMoveTimeoutRef.current) {
                clearTimeout(cursorMoveTimeoutRef.current)
            }

            // Debounce cursor move events
            cursorMoveTimeoutRef.current = setTimeout(() => {
                socket.emit(SocketEvent.CURSOR_MOVE, {
                    cursorPosition,
                    selectionStart,
                    selectionEnd
                })
            }, 100) // 100ms debounce
        }
    }, [lastCursorPosition, lastSelection, socket])

    // Listen wheel event to zoom in/out and prevent page reload
    usePageEvents()

    useEffect(() => {
        const baseExtensions = [
            color,
            hyperLink,
            collaborativeHighlighting(),
            EditorView.updateListener.of(handleSelectionChange),
            scrollPastEnd(),
        ]

        let langExt: Extension | null = null
        
        // Try to load language using enhanced language extensions first
        if (actualLanguage && languageExtensions[actualLanguage]) {
            try {
                langExt = languageExtensions[actualLanguage]()
                console.log(`Loaded enhanced syntax highlighting for: ${actualLanguage}`)
            } catch (error) {
                console.warn(`Failed to load enhanced language ${actualLanguage}:`, error)
            }
        }
        
        // Fallback to basic language loading
        if (!langExt && actualLanguage) {
            try {
                langExt = loadLanguage(actualLanguage)
                console.log(`Loaded basic syntax highlighting for: ${actualLanguage}`)
            } catch (error) {
                console.warn(`Failed to load basic language ${actualLanguage}:`, error)
            }
        }

        if (langExt) {
            setExtensions([...baseExtensions, langExt])
        } else {
            // Show warning only if we have a language that couldn't be mapped
            if (actualLanguage) {
                console.warn(`No syntax highlighting available for: ${actualLanguage}`)
                toast.error(
                    `Syntax highlighting is unavailable for "${actualLanguage}". Using plain text mode.`,
                    {
                        duration: 4000,
                        icon: '⚠️',
                    },
                )
            }
            setExtensions(baseExtensions)
        }
    }, [actualLanguage, language, filteredUsers, handleSelectionChange])

    // Update remote users when filteredUsers changes
    useEffect(() => {
        if (editorRef.current?.view) {
            editorRef.current.view.dispatch({
                effects: updateRemoteUsers.of(filteredUsers)
            })
        }
    }, [filteredUsers])

    return (
        <CodeMirror
            ref={editorRef}
            theme={editorThemes[theme]}
            onChange={onCodeChange}
            value={activeFile?.content}
            extensions={extensions}
            minHeight="100%"
            maxWidth="100vw"
            style={{
                fontSize: fontSize + "px",
                height: viewHeight,
                position: "relative",
            }}
        />
    )
}

export default Editor