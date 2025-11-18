import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { RemoteUser, USER_CONNECTION_STATUS } from "@/types/user"
import Avatar from "react-avatar"
import toast from "react-hot-toast"
import { FiCamera } from "react-icons/fi"
import { useEffect } from "react"

function Users() {
    const { users, setUsers } = useAppContext()
    const { socket } = useSocket()

    useEffect(() => {
        if (!socket) return;

        const handleUserPhotoUpdated = (data: { username: string; photo?: string }) => {
            console.log("Photo updated for user:", data.username, data.photo);
            
            setUsers(prevUsers => 
                prevUsers.map(user => 
                    user.username === data.username 
                        ? { ...user, photo: data.photo }
                        : user
                )
            );
        };

        socket.on("USER_PHOTO_UPDATED", handleUserPhotoUpdated);

        return () => {
            socket.off("USER_PHOTO_UPDATED", handleUserPhotoUpdated);
        };
    }, [socket, setUsers]);

    return (
        <div className="flex min-h-[200px] flex-grow justify-center overflow-y-auto py-2">
            <div className="flex h-full w-full flex-wrap items-start gap-x-2 gap-y-6">
                {users.map((user) => (
                    <User key={user.socketId} user={user} />
                ))}
            </div>
        </div>
    )
}

const User = ({ user }: { user: RemoteUser }) => {
    const { currentUser } = useAppContext()
    const { socket } = useSocket()
    const { username, status, photo, roomId } = user
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

    const isMe = currentUser?.username === username

    const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isMe) return

        const file = e.target.files?.[0]
        if (!file) return

        console.log("Uploading file:", file.name)

        const formData = new FormData()
        formData.append("photo", file)
        formData.append("roomId", roomId)
        formData.append("username", username)

        try {
            const res = await fetch(`${BACKEND_URL}/upload-photo`, {
                method: "POST",
                body: formData
            })

            const data = await res.json()
            console.log("Upload response:", data)

            if (data.success && data.photo) {
                toast.success("Photo updated!")

                console.log("New photo path:", data.photo)

                // Emit socket event with new photo path
                socket.emit("USER_PHOTO_UPDATED", {
                    username,
                    photo: data.photo
                })
            } else {
                toast.error("Failed to update photo")
            }
        } catch (err) {
            console.error("Upload error:", err)
            toast.error("Server error")
        }
    }

    // Build final image URL if photo exists
    const imageUrl = photo ? `${BACKEND_URL}${photo}` : undefined
    console.log("Final image URL for", username, ":", imageUrl)

    return (
        <div className="relative flex w-[100px] flex-col items-center gap-2">
            <label className={`group relative ${isMe ? "cursor-pointer" : "cursor-default"}`}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={username}
                        className="h-[50px] w-[50px] rounded-xl object-cover"
                        onError={() => console.error("Failed to load image:", imageUrl)}
                    />
                ) : (
                    <Avatar name={username} size="50" round={"12px"} />
                )}

                {/* Camera icon only for own profile */}
                {isMe && (
                    <div
                        className="
                            absolute bottom-[-4px] right-[-4px]
                            bg-black/60 text-white
                            p-[2px] rounded-full
                            opacity-0 group-hover:opacity-100
                            transition-opacity
                        "
                    >
                        <FiCamera size={14} />
                    </div>
                )}

                {/* Only owner can change profile */}
                {isMe && (
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpdate}
                    />
                )}
            </label>

            <p className="line-clamp-2 max-w-full text-ellipsis break-words">{username}</p>

            <div
                className={`absolute right-5 top-0 h-3 w-3 rounded-full ${
                    status === USER_CONNECTION_STATUS.ONLINE ? "bg-green-500" : "bg-danger"
                }`}
            ></div>
        </div>
    )
}

export default Users
