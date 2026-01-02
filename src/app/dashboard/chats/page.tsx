
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare, Users, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ChatListItem {
  id: string;
  participants: string[];
  participantNames?: { [key: string]: string };
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string; // Optional: if you store avatar URLs
}

export default function ChatListPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    setIsLoading(true);
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedChatsPromises = querySnapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((pId: string) => pId !== user.uid);
        
        let otherUserName = 'Chat User';
        let otherUserAvatar: string | undefined;

        if (otherUserId) {
          if (data.participantNames && data.participantNames[otherUserId]) {
            otherUserName = data.participantNames[otherUserId];
          } else {
            // Fallback: fetch name if not in chatMetaData.participantNames
            try {
              const userDocRef = doc(db, 'users', otherUserId);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                otherUserName = userSnap.data()?.name || 'Chat User';
                // otherUserAvatar = userSnap.data()?.avatarUrl; // Example
              }
            } catch (error) {
              console.error("Error fetching other user's name for chat list:", error);
            }
          }
        }

        return {
          id: chatDoc.id,
          participants: data.participants,
          participantNames: data.participantNames,
          lastMessage: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp,
          otherUserId: otherUserId || '',
          otherUserName: otherUserName,
          otherUserAvatar: otherUserAvatar,
        } as ChatListItem;
      });

      const resolvedChats = await Promise.all(fetchedChatsPromises);
      setChatList(resolvedChats);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching chat list: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load your chats.' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, router, toast]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-8">My Chats</h1>
      <Card>
        <CardContent className="p-0">
          {chatList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4" />
              <p>No chats yet.</p>
              <p className="text-sm">Start a conversation from a booking or collaboration request.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-15rem)]"> {/* Adjust height as needed */}
              <ul className="divide-y divide-border">
                {chatList.map((chat) => (
                  <li key={chat.id}>
                    <Link href={`/dashboard/chats/${chat.id}`} legacyBehavior>
                      <a className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                        <Avatar className="h-12 w-12">
                          {chat.otherUserAvatar && <AvatarImage src={chat.otherUserAvatar} alt={chat.otherUserName} />}
                          <AvatarFallback>{chat.otherUserName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{chat.otherUserName}</h3>
                          {chat.lastMessage && <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>}
                        </div>
                        {chat.lastMessageTimestamp && (
                          <time className="text-xs text-muted-foreground whitespace-nowrap">
                            {dayjs(chat.lastMessageTimestamp.toDate()).fromNow(true)}
                          </time>
                        )}
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
