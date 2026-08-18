import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Bot, Plus, Send, Trash2, Menu, X, Paperclip, Image as ImageIcon, FileText, XCircle, Pencil } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import type { AiConversation, AiMessage } from '@shared/api.interface';
import {
  getConversations,
  createConversation,
  getMessages,
  deleteConversation,
  sendStreamMessage,
  updateConversationTitle,
} from '@client/src/api/ai-conversation';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

interface ChatAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  content: string; // base64 data URL for images, extracted text for files
  status: 'ready' | 'processing' | 'error';
  error?: string;
}

const WELCOME_MESSAGE = `你好，我是你的私人销售顾问。

我可以帮你：
• 分析客户意向，给出跟进策略
• 优化沟通话术，提高成交率
• 制定每日工作计划和目标拆解
• 复盘工作进展，发现改进机会

有什么想聊的？`;

const AssistantPage = () => {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  // 按 conversationId 分组的临时消息（用户消息+AI占位），用于流式生成期间和切换对话后保持
  const [pendingMessages, setPendingMessages] = useState<Record<string, AiMessage[]>>({});
  // 按 assistant 临时消息ID 存储流式生成中的内容
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentIdRef = useRef<string | null>(null);

  // 同步 currentId 到 ref，供异步回调中读取最新值
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // textarea 高度自适应
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await getConversations();
      setConversations(data.items);
      return data.items;
    } catch (error) {
      logger.error('加载对话列表失败', error);
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    let mounted = true;
    loadConversations().then((items: AiConversation[]) => {
      if (!mounted) return;
      if (items.length > 0) {
        setCurrentId(items[0].id);
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换对话时加载消息
  useEffect(() => {
    if (!currentId) {
      setMessages([]);
      return;
    }
    let mounted = true;
    setLoadingMessages(true);
    getMessages(currentId)
      .then((data) => {
        if (!mounted) return;
        setMessages(data.items);
      })
      .catch((error: unknown) => {
        logger.error('加载消息失败', error);
      })
      .finally(() => {
        if (mounted) setLoadingMessages(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentId]);

  // 轮询：如果最后一条是用户消息且无AI回复，每3秒检查一次（处理切换页面后AI仍在生成的情况）
  useEffect(() => {
    if (!currentId) return;
    const pending = pendingMessages[currentId] || [];
    const hasPendingAssistant = pending.some(m => m.role === 'assistant');
    // 如果当前对话有正在生成的临时AI消息，不需要轮询（流式回调会更新）
    if (hasPendingAssistant) return;
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'user') return;

    const interval = setInterval(() => {
      getMessages(currentId)
        .then((data) => {
          const newLast = data.items[data.items.length - 1];
          if (newLast && newLast.role === 'assistant' && newLast.content.trim()) {
            setMessages(data.items);
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [currentId, messages.length, pendingMessages]);

  const handleNewConversation = async () => {
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      setCurrentId(conv.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (error) {
      logger.error('新建对话失败', error);
    }
  };

  const handleDeleteConversation = async (
    id: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // 清理该对话的临时消息和流式内容
      const pendingList = pendingMessages[id] || [];
      const assistantIds = pendingList.filter(m => m.role === 'assistant').map(m => m.id);
      setPendingMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (assistantIds.length > 0) {
        setStreamingContent((prev) => {
          const next = { ...prev };
          for (const aid of assistantIds) delete next[aid];
          return next;
        });
      }
      if (currentId === id) {
        setCurrentId(null);
        setMessages([]);
      }
    } catch (error) {
      logger.error('删除对话失败', error);
    }
  };

  const startEditTitle = (conv: AiConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || '新对话');
  };

  const saveEditTitle = async () => {
    if (!editingId) return;
    const title = editingTitle.trim().slice(0, 50);
    if (!title) {
      setEditingId(null);
      return;
    }
    setSavingTitle(true);
    try {
      const result = await updateConversationTitle(editingId, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, title: result.title } : c)),
      );
      setEditingId(null);
    } catch (error) {
      logger.error('修改标题失败', error);
      alert('修改标题失败，请重试');
    } finally {
      setSavingTitle(false);
    }
  };

  const cancelEditTitle = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`图片 ${file.name} 超过10MB限制`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const att: ChatAttachment = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'image',
          name: file.name,
          size: file.size,
          content: reader.result as string,
          status: 'ready',
        };
        setAttachments((prev) => [...prev, att]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`文件 ${file.name} 超过10MB限制`);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const textExts = ['txt', 'md', 'csv', 'json'];
      const att: ChatAttachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'file',
        name: file.name,
        size: file.size,
        content: '',
        status: 'processing',
      };
      setAttachments((prev) => [...prev, att]);

      try {
        if (textExts.includes(ext)) {
          // 文本文件直接读取
          const text = await file.text();
          setAttachments((prev) =>
            prev.map((a) => (a.id === att.id ? { ...a, content: text, status: 'ready' } : a)),
          );
        } else {
          // 文档文件上传到后端提取
          const formData = new FormData();
          formData.append('file', file);
          const resp = await axiosForBackend({
            url: '/api/files/extract',
            method: 'POST',
            data: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (resp.data.success) {
            setAttachments((prev) =>
              prev.map((a) => (a.id === att.id ? { ...a, content: resp.data.text, status: 'ready' } : a)),
            );
          } else {
            setAttachments((prev) =>
              prev.map((a) => (a.id === att.id ? { ...a, status: 'error', error: resp.data.error || '提取失败' } : a)),
            );
          }
        }
      } catch (err) {
        logger.error('文件提取失败', err);
        setAttachments((prev) =>
          prev.map((a) => (a.id === att.id ? { ...a, status: 'error', error: '文件处理失败' } : a)),
        );
      }
    }
    e.target.value = '';
  };

  const handleSend = async () => {
    const readyAttachments = attachments.filter((a) => a.status === 'ready');
    if (!input.trim() && readyAttachments.length === 0) return;
    if (attachments.some((a) => a.status === 'processing')) {
      alert('请等待文件处理完成');
      return;
    }
    const content = input.trim();
    setInput('');
    const sentAttachments = readyAttachments.map((a) => ({
      type: a.type,
      name: a.name,
      content: a.content,
    }));
    setAttachments([]);

    // 确保有当前对话，没有则自动创建
    let convId = currentId;
    if (!convId) {
      try {
        const conv = await createConversation();
        setConversations((prev) => [conv, ...prev]);
        convId = conv.id;
        setCurrentId(conv.id);
      } catch (error) {
        logger.error('创建对话失败', error);
        return;
      }
    }

    // 为本次请求生成唯一ID，确保流式内容绑定到正确的消息
    const userTempId = `temp-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const assistantTempId = `temp-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const userMsg: AiMessage = {
      id: userTempId,
      conversationId: convId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: AiMessage = {
      id: assistantTempId,
      conversationId: convId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    // 将临时消息放入 pendingMessages（按 conversationId 分组），切换对话不会丢失
    setPendingMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), userMsg, assistantMsg],
    }));
    setStreamingContent((prev) => ({ ...prev, [assistantTempId]: '' }));

    try {
      await sendStreamMessage(convId, { content, attachments: sentAttachments }, (fullText: string) => {
        // 只更新本次请求对应的 assistant 消息内容，按 messageId 精确绑定
        setStreamingContent((prev) => ({ ...prev, [assistantTempId]: fullText }));
      });

      // 发送完成后，从 pending 中移除临时消息，并刷新当前对话（如果正在查看）
      setPendingMessages((prev) => {
        const list = (prev[convId] || []).filter(
          (m) => m.id !== userTempId && m.id !== assistantTempId,
        );
        return { ...prev, [convId]: list };
      });
      setStreamingContent((prev) => {
        const next = { ...prev };
        delete next[assistantTempId];
        return next;
      });

      // 如果当前正在查看这个对话，刷新消息列表获取真实数据库消息
      if (currentIdRef.current === convId) {
        getMessages(convId)
          .then((data) => setMessages(data.items))
          .catch(() => {});
      }

      // 延迟刷新对话列表，等待后端异步生成标题
      setTimeout(() => {
        loadConversations();
      }, 2000);
    } catch (error) {
      logger.error('发送消息失败', error);
      // 标记错误内容，保留在 pending 中让用户看到
      setStreamingContent((prev) => ({
        ...prev,
        [assistantTempId]: prev[assistantTempId] || '[发送失败，请重试]',
      }));
      // 3秒后移除错误的临时消息
      setTimeout(() => {
        setPendingMessages((prev) => {
          const list = (prev[convId] || []).filter(
            (m) => m.id !== userTempId && m.id !== assistantTempId,
          );
          return { ...prev, [convId]: list };
        });
        setStreamingContent((prev) => {
          const next = { ...prev };
          delete next[assistantTempId];
          return next;
        });
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.floor(
      (today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 7) return `${diff}天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 合并数据库消息 + 临时消息（流式生成中），并去重用户消息
  const pending = currentId ? (pendingMessages[currentId] || []) : [];
  const displayMessages: AiMessage[] = [];
  for (const msg of messages) {
    displayMessages.push(msg);
  }
  for (const pm of pending) {
    if (pm.role === 'user') {
      // 去重：如果数据库中已有相同内容的用户消息，跳过临时的
      const dup = messages.some((m) => m.role === 'user' && m.content === pm.content);
      if (dup) continue;
    }
    // 临时AI消息使用流式内容
    if (pm.role === 'assistant') {
      displayMessages.push({ ...pm, content: streamingContent[pm.id] ?? pm.content });
    } else {
      displayMessages.push(pm);
    }
  }

  // 判断最后一条AI消息是否正在流式生成
  const lastMsg = displayMessages[displayMessages.length - 1];
  const isLastStreaming =
    lastMsg?.role === 'assistant' &&
    lastMsg.id.startsWith('temp-assistant-') &&
    streamingContent[lastMsg.id] !== undefined;

  const showWelcome = displayMessages.length === 0;

  return (
    <div className="h-full md:h-[calc(100vh-108px)] min-h-0 overflow-hidden flex">
      {/* 移动端顶栏 */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card absolute top-0 left-0 right-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <span className="font-semibold text-foreground">
          {conversations.find((c) => c.id === currentId)?.title || 'AI助手'}
        </span>
        <div className="w-9" />
      </div>

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 左侧边栏 */}
      <aside
        className={`
          fixed md:static md:h-full md:min-h-0 md:overflow-hidden inset-y-0 left-0 z-30
          w-72 shrink-0 border-r border-border bg-background
          flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:pt-0 pt-14
        `}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">对话</h2>
          <button
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-3">
          <Button className="w-full" onClick={handleNewConversation}>
            <Plus className="size-4" />
            新建对话
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-3 space-y-1">
          {loadingConversations ? (
            <p className="text-xs text-muted-foreground px-3 py-2">加载中...</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              还没有对话，开始新的对话吧
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  if (editingId === conv.id) return;
                  setCurrentId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`
                  group relative px-3 py-2 rounded-md
                  transition-colors duration-150
                  ${
                    editingId === conv.id
                      ? 'bg-accent/50'
                      : currentId === conv.id
                        ? 'bg-accent text-primary cursor-pointer'
                        : 'text-foreground hover:bg-accent/50 cursor-pointer'
                  }
                `}
              >
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEditTitle();
                        if (e.key === 'Escape') cancelEditTitle();
                      }}
                      maxLength={50}
                      autoFocus
                      disabled={savingTitle}
                      className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-primary bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); void saveEditTitle(); }}
                      className="p-1 rounded text-primary hover:bg-primary/10 shrink-0"
                      title="保存"
                      disabled={savingTitle}
                    >
                      {savingTitle ? '...' : '✓'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEditTitle(); }}
                      className="p-1 rounded text-muted-foreground hover:bg-accent shrink-0"
                      title="取消"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-medium text-sm truncate pr-12">
                      {conv.title || '新对话'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1 pr-12">
                      {conv.lastMessage || '暂无消息'}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDate(conv.createdAt)}
                    </div>
                  </>
                )}
                {editingId !== conv.id && (
                  <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditTitle(conv, e)}
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title="修改标题"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50"
                      title="删除对话"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 中间聊天区 */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-card border-r border-border">
        {/* 标题栏 */}
        <div className="h-14 px-4 border-b border-border flex items-center shrink-0 mt-12 md:mt-0">
          <h2 className="font-semibold text-foreground truncate">
            {currentId
              ? conversations.find((c) => c.id === currentId)?.title || '新对话'
              : '新对话'}
          </h2>
        </div>

        {/* 消息列表 */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-4">
          {loadingMessages && currentId ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              加载中...
            </div>
          ) : showWelcome ? (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div
                  className="shrink-0 size-9 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-primary to-blue-400 text-white"
                >
                  <Bot className="size-5" />
                </div>
                <div
                  className="bg-card border border-border rounded-2xl rounded-tl-sm
                    p-4 shadow-sm border-l-2 border-l-primary"
                >
                  <p className="text-foreground leading-relaxed">
                    {WELCOME_MESSAGE}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div
                      className="shrink-0 size-9 rounded-full flex items-center justify-center
                        bg-gradient-to-br from-primary to-blue-400 text-white mt-1"
                    >
                      <Bot className="size-5" />
                    </div>
                    <div
                      className="bg-card border border-border rounded-2xl rounded-tl-sm
                        p-4 shadow-sm border-l-2 border-l-primary relative"
                    >
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                        {msg.role === 'assistant' &&
                          isLastStreaming &&
                          msg === displayMessages[displayMessages.length - 1] && (
                            <span className="inline-block w-2 h-5 bg-primary ml-1 align-middle animate-pulse rounded-sm" />
                          )}
                      </p>
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="max-w-[80%]">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-4 shadow-sm">
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-border p-4 shrink-0">
          {/* 附件列表 */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className={[
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                    att.status === 'error'
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : att.status === 'processing'
                        ? 'border-amber-200 bg-amber-50 text-amber-600'
                        : 'border-primary/20 bg-primary/5 text-foreground',
                  ].join(' ')}
                >
                  {att.type === 'image' ? (
                    <ImageIcon className="size-3.5 shrink-0" />
                  ) : (
                    <FileText className="size-3.5 shrink-0" />
                  )}
                  <span className="max-w-[160px] truncate">{att.name}</span>
                  {att.status === 'processing' && (
                    <span className="text-xs">处理中...</span>
                  )}
                  {att.status === 'error' && (
                    <span className="text-xs">{att.error || '失败'}</span>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-muted-foreground hover:text-red-500 shrink-0"
                  >
                    <XCircle className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              className="shrink-0 h-11 w-11 rounded-full"
              title="上传图片"
            >
              <ImageIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-11 w-11 rounded-full"
              title="上传文件"
            >
              <Paperclip className="size-4" />
            </Button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="输入你的问题，或上传图片/文件..."
              className="flex-1 min-h-[44px] max-h-[120px] p-3 rounded-lg
                border border-input bg-background text-foreground
                placeholder:text-muted-foreground
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                resize-none text-sm leading-relaxed"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() && attachments.filter((a) => a.status === 'ready').length === 0}
              className="shrink-0 h-11 w-11 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI已读取你的目标、工作记录、客户数据和知识库
          </p>
        </div>
      </main>
    </div>
  );
};

export default AssistantPage;
