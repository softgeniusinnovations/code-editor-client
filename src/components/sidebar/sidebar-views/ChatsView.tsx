import ChatInput from "@/components/chats/ChatInput"
import ChatList from "@/components/chats/ChatList"
import useResponsive from "@/hooks/useResponsive"
import { useParams } from "react-router-dom"

const ChatsView = () => {
    const { viewHeight } = useResponsive()
    const { roomId } = useParams()                   

    return (
        <div
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="view-title">
                    Group Chat -
                    {roomId && (
                        <span className="ml-2 text-xl text-gray-500">
                            {roomId}
                        </span>
                    )}
                </h1>
            </div>

            <ChatList />
            <ChatInput />
        </div>
    )
}

export default ChatsView
