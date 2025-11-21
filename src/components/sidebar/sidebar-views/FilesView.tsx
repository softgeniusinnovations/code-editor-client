import { useState } from "react"
import FileStructureView from "@/components/files/FileStructureView"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { FileSystemItem } from "@/types/file"
import cn from "classnames"
import { BiArchiveIn } from "react-icons/bi"
import { TbFileUpload, TbFolder } from "react-icons/tb"
import { v4 as uuidV4 } from "uuid"
import { toast } from "react-hot-toast"

function FilesView() {
    const { downloadFilesAndFolders, updateDirectory } = useFileSystem()
    const { viewHeight } = useResponsive()
    const { minHeightReached } = useResponsive()
    const [isLoading, setIsLoading] = useState(false)

    const handleOpenDirectory = async () => {
        try {
            setIsLoading(true)

            // Check for modern API support
            if ("showDirectoryPicker" in window) {
                const directoryHandle = await window.showDirectoryPicker()
                await processDirectoryHandle(directoryHandle)
                return
            }

            // Fallback for browsers without `showDirectoryPicker`
            if ("webkitdirectory" in HTMLInputElement.prototype) {
                const fileInput = document.createElement("input")
                fileInput.type = "file"
                fileInput.webkitdirectory = true

                fileInput.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                        const structure = await readFileList(files)
                        updateDirectory("", structure)
                    }
                }

                fileInput.click()
                return
            }

            // Notify if neither API is supported
            toast.error("Your browser does not support directory selection.")
        } catch (error) {
            console.error("Error opening directory:", error)
            toast.error("Failed to open directory")
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenFiles = async () => {
        try {
            setIsLoading(true)
            
            const fileInput = document.createElement("input")
            fileInput.type = "file"
            fileInput.multiple = true

            fileInput.onchange = async (e) => {
                const files = (e.target as HTMLInputElement).files
                if (files && files.length > 0) {
                    await processFiles(files)
                }
            }

            fileInput.click()
        } catch (error) {
            console.error("Error opening files:", error)
            toast.error("Failed to open files")
        } finally {
            setIsLoading(false)
        }
    }

    const processFiles = async (files: FileList) => {
        try {
            toast.loading(`Processing ${files.length} file(s)...`)
            
            const fileItems: FileSystemItem[] = []
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const newFile: FileSystemItem = {
                    id: uuidV4(),
                    name: file.name,
                    type: "file",
                    content: await readFileContent(file),
                }
                fileItems.push(newFile)
            }
            
            // Get current structure and add new files
            const currentStructure = await getCurrentFileStructure()
            const updatedStructure = [...currentStructure, ...fileItems]
            
            // Update the directory with combined structure
            updateDirectory("", updatedStructure)
            
            toast.dismiss()
            toast.success(`Successfully added ${files.length} file(s)`)
        } catch (error) {
            console.error("Error processing files:", error)
            toast.error("Failed to process files")
        }
    }

    // Helper function to get current file structure
    const getCurrentFileStructure = async (): Promise<FileSystemItem[]> => {
        // This would need to be implemented based on your FileContext
        // For now, returning empty array as placeholder
        return []
    }

    const processDirectoryHandle = async (
        directoryHandle: FileSystemDirectoryHandle
    ) => {
        try {
            toast.loading("Getting files and folders...")
            const structure = await readDirectory(directoryHandle)
            updateDirectory("", structure)
            toast.dismiss()
            toast.success("Directory loaded successfully")
        } catch (error) {
            console.error("Error processing directory:", error)
            toast.error("Failed to process directory")
        }
    }

    const readDirectory = async (
        directoryHandle: FileSystemDirectoryHandle
    ): Promise<FileSystemItem[]> => {
        const children: FileSystemItem[] = []
        const blackList = ["node_modules", ".git", ".vscode", ".next"]

        for await (const entry of directoryHandle.values()) {
            if (entry.kind === "file") {
                const file = await entry.getFile()
                const newFile: FileSystemItem = {
                    id: uuidV4(),
                    name: entry.name,
                    type: "file",
                    content: await readFileContent(file),
                }
                children.push(newFile)
            } else if (entry.kind === "directory") {
                if (blackList.includes(entry.name)) continue

                const newDirectory: FileSystemItem = {
                    id: uuidV4(),
                    name: entry.name,
                    type: "directory",
                    children: await readDirectory(entry),
                    isOpen: false,
                }
                children.push(newDirectory)
            }
        }
        return children
    }

    const readFileList = async (files: FileList): Promise<FileSystemItem[]> => {
        const children: FileSystemItem[] = []
        const blackList = ["node_modules", ".git", ".vscode", ".next"]

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const pathParts = file.webkitRelativePath.split("/")

            if (pathParts.some((part) => blackList.includes(part))) continue

            if (pathParts.length > 1) {
                const directoryPath = pathParts.slice(0, -1).join("/")
                const directoryIndex = children.findIndex(
                    (item) =>
                        item.name === directoryPath && item.type === "directory"
                )

                if (directoryIndex === -1) {
                    const newDirectory: FileSystemItem = {
                        id: uuidV4(),
                        name: directoryPath,
                        type: "directory",
                        children: [],
                        isOpen: false,
                    }
                    children.push(newDirectory)
                }

                const newFile: FileSystemItem = {
                    id: uuidV4(),
                    name: file.name,
                    type: "file",
                    content: await readFileContent(file),
                }

                const targetDirectory = children.find(
                    (item) =>
                        item.name === directoryPath && item.type === "directory"
                )
                if (targetDirectory && targetDirectory.children) {
                    targetDirectory.children.push(newFile)
                }
            } else {
                const newFile: FileSystemItem = {
                    id: uuidV4(),
                    name: file.name,
                    type: "file",
                    content: await readFileContent(file),
                }
                children.push(newFile)
            }
        }
        return children
    }

    const readFileContent = async (file: File): Promise<string> => {
        try {
            // For text-based files, try to read as text
            if (file.type.startsWith('text/') || 
                file.type === 'application/json' ||
                file.name.match(/\.(txt|js|jsx|ts|tsx|css|html|json|xml|md|py|java|c|cpp|cs|php|rb|go|rs|sh|bat|ps1)$/i)) {
                return await file.text()
            }
            
            // For binary files, read as ArrayBuffer and convert to base64
            const arrayBuffer = await file.arrayBuffer()
            const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            )
            
            // Return a data URL representation for binary files
            return `data:${file.type};base64,${base64}`
            
        } catch (error) {
            console.error(`Error reading file ${file.name}:`, error)
            
            // For very large files or unsupported types, provide file info instead
            return `Binary file: ${file.name} (${Math.round(file.size / 1024)}KB) - ${file.type || 'Unknown type'}`
        }
    }

    return (
        <div
            className="flex select-none flex-col gap-1 px-4 py-2"
            style={{ height: viewHeight, maxHeight: viewHeight }}
        >
            <FileStructureView />
            <div
                className={cn(`flex min-h-fit flex-col justify-end pt-2`, {
                    hidden: minHeightReached,
                })}
            >
                <hr />
                <button
                    className="mt-2 flex w-full justify-start rounded-md p-2 transition-all hover:bg-darkHover"
                    onClick={handleOpenDirectory}
                    disabled={isLoading}
                >
                    <TbFolder className="mr-2" size={24} />
                    {isLoading ? "Loading..." : "Open Folder"}
                </button>
                <button
                    className="flex w-full justify-start rounded-md p-2 transition-all hover:bg-darkHover"
                    onClick={handleOpenFiles}
                    disabled={isLoading}
                >
                    <TbFileUpload className="mr-2" size={24} />
                    {isLoading ? "Loading..." : "Add Files"}
                </button>
                <button
                    className="flex w-full justify-start rounded-md p-2 transition-all hover:bg-darkHover"
                    onClick={downloadFilesAndFolders}
                >
                    <BiArchiveIn className="mr-2" size={22} /> Download Code
                </button>
            </div>
        </div>
    )
}

export default FilesView