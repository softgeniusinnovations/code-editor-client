import Users from "@/components/common/Users"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { USER_STATUS } from "@/types/user"
import toast from "react-hot-toast"
import { GoSignOut } from "react-icons/go"
import { IoShareOutline } from "react-icons/io5"
import { LuCopy } from "react-icons/lu"
import { useNavigate } from "react-router-dom"

function UsersView() {
    const navigate = useNavigate()
    const { viewHeight } = useResponsive()
    const { setStatus, currentUser } = useAppContext()
    const { socket } = useSocket()

    const copyURL = async () => {
        const url = window.location.href
        const roomName = currentUser?.roomId || "Chat Room"
        const shareText = `Join me in "${roomName}" room!\n${url}`
        
        try {
            await navigator.clipboard.writeText(shareText)
            toast.success(`"${roomName}" room link copied!`)
        } catch (error) {
            toast.error("Unable to copy URL to clipboard")
            console.log(error)
        }
    }

    const shareURL = async () => {
        const url = window.location.href
        const roomName = currentUser?.roomId || "Chat Room"
        const shareText = `Join me in "${roomName}" room!`
        
        const shareData = {
            title: `${roomName} - Chat Room`,
            text: shareText,
            url: url
        }

        try {
            if (navigator.share && navigator.canShare?.(shareData)) {
                await navigator.share(shareData)
                toast.success(`"${roomName}" room shared successfully!`)
            } else {
                // Fallback - copy to clipboard with room info
                await navigator.clipboard.writeText(`${shareText}\n${url}`)
                toast.success(`"${roomName}" room link copied to clipboard!`)
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                // If sharing fails or is cancelled, fallback to copy
                await navigator.clipboard.writeText(`${shareText}\n${url}`)
                toast.success(`"${roomName}" room link copied to clipboard!`)
            }
        }
    }

    const leaveRoom = () => {
        socket.disconnect()
        setStatus(USER_STATUS.DISCONNECTED)
        navigate("/", {
            replace: true,
        })
    }

    return (
        <div className="flex flex-col p-4" style={{ height: viewHeight }}>
            {/* Simple Header without Room ID */}
            <div className="mb-6">
                <h1 className="view-title">Users</h1>
            </div>
            
            {/* List of connected users */}
            <Users />
            <div className="flex flex-col items-center gap-4 pt-4">
                <div className="flex w-full gap-4">
                    {/* Share URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={shareURL}
                        title={`Share "${currentUser?.roomId || 'Room'}" link`}
                    >
                        <IoShareOutline size={26} />
                    </button>
                    {/* Copy URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-white p-3 text-black"
                        onClick={copyURL}
                        title={`Copy "${currentUser?.roomId || 'Room'}" link`}
                    >
                        <LuCopy size={22} />
                    </button>
                    {/* Leave room button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-md bg-primary p-3 text-black"
                        onClick={leaveRoom}
                        title="Leave room"
                    >
                        <GoSignOut size={22} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UsersView