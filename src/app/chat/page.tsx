'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, ArrowLeft } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import Spinner from '@/components/ui/Spinner';
import VerifiedBadge from '@/components/shared/VerifiedBadge';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get('seller');
  const productId = searchParams.get('product');
  const [message, setMessage] = useState('');
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
      if (!profile) return [];
      const { data } = await supabase
        .from('conversations')
        .select('*, buyer:profiles!conversations_buyer_id_fkey(full_name, verification_status), seller:profiles!conversations_seller_id_fkey(full_name, verification_status), product:products(title, price)')
        .or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`)
        .order('last_message_at', { ascending: false });
      return data || [];
    },
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', activeConversation],
    queryFn: async () => {
      if (!activeConversation) return [];
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(full_name)')
        .eq('conversation_id', activeConversation)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!activeConversation,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!activeConversation) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
      if (!profile) return;
      await supabase.from('messages').insert({
        conversation_id: activeConversation,
        sender_id: profile.id,
        content,
        message_type: 'TEXT',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversation] });
      setMessage('');
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto h-[calc(100vh-120px)]">
          <div className="flex h-full bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mt-4 mx-4">
            {/* Conversations list */}
            <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingConvs ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : conversations?.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">No conversations yet</div>
                ) : conversations?.map((conv: {
                  id: string;
                  last_message_at: string;
                  buyer: { full_name: string; verification_status: string };
                  seller: { full_name: string; verification_status: string };
                  product: { title: string; price: number };
                }) => (
                  <button key={conv.id} onClick={() => setActiveConversation(conv.id)}
                    className={`w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${activeConversation === conv.id ? 'bg-green-50' : ''}`}>
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold flex-shrink-0">
                      {conv.buyer?.full_name?.[0] || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{conv.buyer?.full_name || 'User'}</p>
                      <p className="text-xs text-gray-400 truncate">{conv.product?.title}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(conv.last_message_at)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Messages area */}
            <div className={`flex-1 flex flex-col ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
              {activeConversation ? (
                <>
                  <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <button onClick={() => setActiveConversation(null)} className="md:hidden p-1 rounded-lg hover:bg-gray-100">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">U</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Conversation</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMsgs ? <div className="flex justify-center py-8"><Spinner /></div> : messages?.map((msg: {
                      id: string;
                      content: string;
                      created_at: string;
                      sender_id: string;
                      sender: { full_name: string };
                    }) => (
                      <div key={msg.id} className="flex gap-2">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {msg.sender?.full_name?.[0] || '?'}
                        </div>
                        <div className="max-w-xs">
                          <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5">
                            <p className="text-sm text-gray-900">{msg.content}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(msg.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t border-gray-100 flex gap-3">
                    <input type="text" value={message} onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <button onClick={handleSend}
                      className="w-11 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Send className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm">Select a conversation to start chatting</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
