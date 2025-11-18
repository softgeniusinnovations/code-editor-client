import { ChatContext as ChatContextType, ChatMessage } from "@/types/chat"
import { SocketEvent } from "@/types/socket"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import { useSocket } from "./SocketContext"
import { useAppContext } from "@/context/AppContext" // Import AppContext

const ChatContext = createContext<ChatContextType | null>(null)

export const useChatRoom = (): ChatContextType => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error("useChatRoom must be used within a ChatContextProvider")
    }
    return context
}

function ChatContextProvider({ children }: { children: ReactNode }) {
    const { socket } = useSocket()
    const { currentUser } = useAppContext() // Get currentUser from AppContext
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isNewMessage, setIsNewMessage] = useState<boolean>(false)
    const [lastScrollHeight, setLastScrollHeight] = useState<number>(0)
    const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(false)

    // Listen for room join success
    useEffect(() => {
        if (!socket) return;

        const handleJoinAccepted = () => {
            console.log("User joined room, loading chat history...");
            setHasJoinedRoom(true);
        };

        socket.on(SocketEvent.JOIN_ACCEPTED, handleJoinAccepted);

        return () => {
            socket.off(SocketEvent.JOIN_ACCEPTED, handleJoinAccepted);
        };
    }, [socket]);

    // Load chat history only after joining room
    useEffect(() => {
        if (!socket || !hasJoinedRoom) {
            console.log("Socket not ready or user not joined room yet");
            return;
        }

        console.log("Requesting chat history...");
        socket.emit(SocketEvent.LOAD_CHAT_HISTORY);

        socket.on(SocketEvent.CHAT_HISTORY_LOADED, ({ messages }) => {
            console.log("Received chat history:", messages?.length || 0, "messages");

            if (messages && Array.isArray(messages)) {
                setMessages(messages);
            } else {
                console.log("No chat history or invalid format");
                setMessages([]);
            }
        });

        return () => {
            console.log("Cleanup: removing CHAT_HISTORY_LOADED listener");
            socket.off(SocketEvent.CHAT_HISTORY_LOADED);
        };
    }, [socket, hasJoinedRoom]);

    // Listen for new messages
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = ({ message }: { message: ChatMessage }) => {
            console.log("New message received:", message);
            setMessages((prevMessages) => [...prevMessages, message]);
            setIsNewMessage(true);
        };

        socket.on(SocketEvent.RECEIVE_MESSAGE, handleReceiveMessage);

        return () => {
            socket.off(SocketEvent.RECEIVE_MESSAGE);
        };
    }, [socket]);

    // Reset when user leaves
    useEffect(() => {
        if (!currentUser?.username) {
            setMessages([]);
            setHasJoinedRoom(false);
        }
    }, [currentUser]);

    return (
        <ChatContext.Provider
            value={{
                messages,
                setMessages,
                isNewMessage,
                setIsNewMessage,
                lastScrollHeight,
                setLastScrollHeight,
            }}
        >
            {children}
        </ChatContext.Provider>
    )
}

export { ChatContextProvider }