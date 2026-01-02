
'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  type Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
}

interface ChatMetadata extends DocumentData {
    participants?: string[];
    participantNames?: { [key: string]: string };
    participantAvatars?: { [key: string]: string }; // Assuming you might store this
}


export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { chatId } = params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMetadata, setChatMetadata] = useState<ChatMetadata | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    // Fetch chat metadata first to verify user is a participant
    const chatDocRef = doc(db, 'chats', chatId);
    const getChatMetadata = async () => {
        try {
            const chatSnap = await getDoc(chatDocRef);
            if (!chatSnap.exists()) {
                toast({ variant: 'destructive', title: 'Chat Not Found', description: 'This chat does not exist.' });
                router.replace('/dashboard/chats');
                return;
            }

            const data = chatSnap.data();
            if (!data.participants?.includes(user.uid)) {
                toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not a member of this chat.' });
                router.replace('/dashboard/chats');
                return;
            }
            setChatMetadata(data);
        } catch (error) {
            console.error("Error fetching chat metadata:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load chat details.' });
            router.replace('/dashboard/chats');
        }
    };

    getChatMetadata();

    // Set up messages listener
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(fetchedMessages);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load messages.' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, chatId, router, toast]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user) return;

    setIsSending(true);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    try {
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
      
      // Also update the last message on the parent chat document for the chat list
      const chatDocRef = doc(db, 'chats', chatId);
      await updateDoc(chatDocRef, {
          lastMessage: newMessage.trim(),
          lastMessageTimestamp: serverTimestamp()
      });

    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
    } finally {
        setIsSending(false);
    }
  };
  
  const otherUserId = chatMetadata?.participants?.find(pId => pId !== user?.uid);
  const otherUserName = otherUserId ? chatMetadata?.participantNames?.[otherUserId] : 'Chat Partner';
  const otherUserAvatar = otherUserId ? chatMetadata?.participantAvatars?.[otherUserId] : undefined;


  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto border-x">
      <header className="flex items-center p-4 border-b bg-card shadow-sm">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
         <Avatar className="h-10 w-10 mr-3">
            {otherUserAvatar && <AvatarImage src={otherUserAvatar} alt={otherUserName} />}
            <AvatarFallback>{otherUserName?.charAt(0)?.toUpperCase() || 'P'}</AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-semibold">{otherUserName}</h2>
      </header>
      
      <ScrollArea className="flex-1 bg-muted/30" ref={scrollAreaRef}>
        <div className="p-4 space-y-4" ref={viewportRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-2 max-w-xs sm:max-w-md",
                msg.senderId === user?.uid ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "rounded-lg px-4 py-2 shadow-sm",
                  msg.senderId === user?.uid
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card text-card-foreground rounded-bl-none"
                )}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={cn("text-xs mt-1 opacity-70", msg.senderId === user?.uid ? "text-right" : "text-left")}>
                    {msg.timestamp ? dayjs(msg.timestamp.toDate()).format('h:mm A') : 'sending...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <footer className="p-4 border-t bg-card">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            autoComplete="off"
            disabled={isSending}
          />
          <Button type="submit" size="icon" disabled={isSending || newMessage.trim() === ''}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </footer>
    </div>
  );
}
