"use client";

import { type CoreMessage } from "ai";
import React, { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { readStreamableValue } from "ai/rsc";
import { continueConversation } from "@/app/actions/chat";
import { saveChat, createChatSession } from "@/app/actions/index";
import { User } from "next-auth";
import Image from "next/image";
import {
  Cpu,
  Check,
  RotateCcw,
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { characters, ChatMessage, ChatMessageArray, personas } from "@/server/db/schema";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";
import { getModelArray } from "@/lib/llm_models";
import SignInButton from "@/components/signin-button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";  
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { AdsProvider, InlineAd } from '@kontextso/sdk';
import { PAID_USER_IDS } from "@/lib/utils";

const MAX_TEXTAREA_HEIGHT = 450; // maximum height in pixels

interface MessageContentProps {
  characterId?: string
  showRetries: boolean;
  userImage?: string | undefined | null;
  message: ChatMessage;
  index: number;
  isUser: boolean;
  userName?: string;
  characterName: string;
  characterAvatarUrl?: string | undefined | null;
  isError?: boolean;
  chatSession?: string | null;
  onRetry?: () => void;
  onEdit: (index: number, editedContent: string) => void;
  onDelete: (index: number) => void;
  onGoBackRegenerate?: (toIndex: number) => void;
  regenerations: string[];
  currentRegenerationIndex: number;
  onNewChatFromHere: (index: number) => void;
  onRewindHere: (index: number) => void;
  onRateMessage: (index: number, rating: number) => void;
}

const MessageContent: React.FC<MessageContentProps> = ({
  characterId,
  showRetries,
  userImage,
  message,
  index,
  isUser,
  userName,
  characterName,
  characterAvatarUrl,
  isError,
  onRetry,
  onEdit,
  onDelete,
  onGoBackRegenerate,
  regenerations,
  currentRegenerationIndex,
  onNewChatFromHere,
  onRewindHere,
  onRateMessage,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content as string);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRating = (rating: number) => {
    onRateMessage(index, rating);
  };

  const markdownComponents: Partial<Components> = {
    p: ({ children }) => <p className="mb-2 last:mb-0 text-wrap break-words">{children}</p>,
    em: ({ children }) => <em className="text-neutral-300 text-wrap break-words">{children}</em>,
    code: ({ children }) => (
      <code className="bg-neutral-800 px-1 py-0.5 rounded text-sm text-neutral-200">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-neutral-800 p-2 rounded text-sm text-neutral-200 whitespace-pre-wrap break-words overflow-x-auto">
        {children}
      </pre>
    ),
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content as string);
    setIsDropdownOpen(false);
  };

  const handleSave = () => {
    onEdit(index, editedContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(message.content as string);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setIsDropdownOpen(false);
  };

  const confirmDelete = () => {
    onDelete(index);
    setIsDeleting(false);
  };

  const cancelDelete = () => {
    setIsDeleting(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  const handleDropdownOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
  };

  if (isDeleting) {
    return (
      <dialog className="fixed bottom-0 top-0 flex flex-col items-center justify-center p-4 bg-black rounded-lg shadow-lg">
        <p className="mb-4 text-white">Are you sure you want to delete this message?</p>
        <div className="flex gap-4 w-full flex justify-between">
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} variant="destructive">Delete</Button>
        </div>
      </dialog>
    );
  }

  return (
    <div 
      className="flex items-start mb-8 w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isDropdownOpen) {
          setIsDropdownOpen(false);
        }
      }}
    >
      <Link className="mr-4 flex-shrink-0 overflow-hidden" style={{ width: `${localStorage.getItem("character_icon_size") ?? '40'}px`, height: `${localStorage.getItem("character_icon_size") ?? '40'}px` }}
        href={isUser ? "/profile" : `/character/${characterId}/profile`}
      >
        <img 
          src={isUser ? (userImage ?? "/opencharacter_icon.png") : (characterAvatarUrl || "/default-avatar.jpg")}
          alt={isUser ? (userName ?? "Guest") : characterName}
          className={`w-full h-full object-cover ${localStorage.getItem("character_icon_style") === "circle" ? "rounded-full" : "rounded-lg"}`}
        />
      </Link>
      <div className="flex flex-col max-w-full flex-grow overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-neutral-400">
            {isUser ? userName || "You" : characterName}
          </span>
          {!isEditing && (isHovered || isDropdownOpen) && (
            <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <button className="text-neutral-400 hover:text-neutral-300 focus:outline-none">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex flex-col gap-2">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { onRewindHere(index); setIsDropdownOpen(false); }}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rewind to here
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { onNewChatFromHere(index); setIsDropdownOpen(false); }}>
                  <ChevronRight className="w-4 h-4 mr-2" />
                  New chat from here
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="max-w-xl text-wrap break-words">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={editedContent}
                onChange={handleTextareaChange}
                className="min-h-[100px] text-sm text-slate-300 overflow-y-auto"
                rows={1}
              />
              <div className="flex justify-start gap-2">
                <Button variant="outline" onClick={handleCancel} className="rounded-full">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="rounded-full">
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <ReactMarkdown
              className="text-md text-white text-wrap break-words flex flex-wrap max-w-full"
              components={markdownComponents}
            >
              {message.content as string}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && showRetries && index != 1 && (
        <div className="w-full flex justify-between max-w-full flex-row">
          <div className="items-center flex">
            <div className="flex space-x-1">
              {Array.from({ length: 5 }, (_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 transition-transform transform hover:scale-125 cursor-pointer ${
                      (message.rating || 0) >= i + 1 ? 'text-yellow-500' : 'text-gray-600'
                    }`} 
                    onClick={() => handleRating(i + 1)}
                    fill={(message.rating || 0) >= i + 1 ? '#FFFF00' : ''}
                  />
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-4 ml-2">
            <button 
              className="p-1 rounded-full"
              onClick={() => {
                  if (currentRegenerationIndex - 1 <= 0) {
                    currentRegenerationIndex = 1;
                  }
                  onGoBackRegenerate && onGoBackRegenerate(currentRegenerationIndex - 1);
              }}
              disabled={currentRegenerationIndex == 0}
            >
              <ChevronLeft className={`w-4 h-4 ${currentRegenerationIndex <= 0 ? "text-slate-700" : ""}`} />
            </button>
            <span className="text-sm text-gray-400">
              {currentRegenerationIndex} / {30}
            </span>
            <button 
              className="p-1 rounded-full"
              onClick={() => {
                if (currentRegenerationIndex < regenerations.length - 1) {
                  onGoBackRegenerate && onGoBackRegenerate(currentRegenerationIndex + 1);
                } else {
                  onRetry && onRetry();
                }
              }}
              disabled={regenerations.length >= 30}
            >
              <ChevronRight className={`w-4 h-4 ${regenerations.length >= 30 ? "text-slate-700" : ""}`} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default function MessageAndInput({
  user,
  character,
  made_by_name,
  messages,
  chat_session,
  persona,
  share = false, // Default value set to false
}: {
  user: User | undefined;
  character: typeof characters.$inferSelect;
  made_by_name: string;
  messages: CoreMessage[];
  chat_session?: string | undefined;
  persona?: typeof personas.$inferSelect | undefined;
  share?: boolean; // Removed default value from type definition
}) {
  const router = useRouter();
  const replacePlaceholders = (content: string | undefined) => {
    if (content === undefined) {
      return content;
    }
    return content
      .replace(/{{user}}/g, persona?.displayName || user?.name || "Guest")  
      .replace(/{{char}}/g, character.name || "");
  };

  const [messagesState, setMessagesState] =
    useState<CoreMessage[]>(messages);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gryphe/mythomax-l2-13b");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<boolean>(false);
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [regenerations, setRegenerations] = useState<string[]>([messagesState[messagesState.length -1].content as string]);
  const [currentRegenerationIndex, setCurrentRegenerationIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const { toast } = useToast()

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustTextareaHeight();
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;

      // Add scrollbar if content exceeds max height
      textareaRef.current.style.overflowY =
        scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    }
  };

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (window.innerWidth > 768) {
      // Desktop
      if (e.key === "Enter" && !e.shiftKey) {
        // submit form
        e.preventDefault();
        formRef.current?.requestSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        resetTextareaHeight();
        if (input.trim() === "") {
          setInput("");
        }
      }
    }
  };

  const handleEdit = async (index: number, editedContent: string) => {
    const newMessages = messagesState.map((msg, i) =>
      i === index ? ({ ...msg, content: editedContent } as CoreMessage) : msg,
    );

    setMessagesState(newMessages);

    try {
      await saveChat(newMessages, character, chat_session);
    } catch (error) {
      console.error("Failed to save edited message:", error);
      // Optionally, revert the change in the UI or show an error message to the user
    }
  };

  const handleOnGoBackRegenerate = async (index: number) => {
    const wantMessage = regenerations[index];
    const newMessages = [...messagesState];
    
    // Find the last assistant message and replace its content
    for (let i = newMessages.length - 1; i >= 0; i--) {
      if (newMessages[i].role === "assistant") {
        newMessages[i].content = wantMessage;
        break;
      }
    }
    
    setMessagesState(newMessages);
    await saveChat(newMessages, character, chat_session)
    setCurrentRegenerationIndex(index);
  };

  const handleDelete = async (index: number) => {
    const newMessages = messagesState.filter((_, i) => i !== index);

    setMessagesState(newMessages);

    try {
      await saveChat(newMessages, character, chat_session);
      toast({
        title: "Deleted Message",
        className: "text-xs"
      })
    } catch (error) {
      console.error("Failed to save after deleting message:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  useEffect(() => {
    scrollToBottom()
  }, [])

  useEffect(() => {
    const savedModel = localStorage.getItem("selectedModel");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesState]);

  const handleInputFocus = () => {
    if (!user) {
      setIsSignInDialogOpen(true);
    }
  };

  const handleSubmit = async (
    input: string,
    error: boolean = false,
    regenerate: boolean = false,
  ) => {
    if (!user) {
      setIsSignInDialogOpen(true);
      return;
    }

    let newMessages: CoreMessage[];

    if (regenerate && !error) {
      // Remove the last assistant message
      newMessages = messagesState.slice(0, -1);
    } else if (error) {
      newMessages = [...messagesState];
    } else if (input) {
      newMessages = [...messagesState, { content: input, role: "user" }];
    } else {
      // if !input, 
      newMessages = [...messagesState];
    }

    setMessagesState(newMessages);
    setInput("");
    resetTextareaHeight();
    setIsLoading(true);
    setError(false);

    try {
      const result = await continueConversation(
        newMessages as ChatMessageArray,
        selectedModel,
        character,
        chat_session,
      );
      if ("error" in result) {
        setError(true);
        console.log(result.error)
        setErrorMessage(result.message)
        return;
      }
      console.log("result: ", result)
      for await (const content of readStreamableValue(result)) {
        setMessagesState([
          ...newMessages,
          {
            role: "assistant",
            content: replacePlaceholders(content) as string,
          },
        ]);
        setRegenerations([
          ...regenerations,
          replacePlaceholders(content) as string,
        ]);
        if (!regenerate && !error) {
          setCurrentRegenerationIndex(0)
          setRegenerations([replacePlaceholders(content) as string])
        }
      }
    } catch (err) {
      console.log(err)
      setError(true);
    } finally {
      setIsLoading(false);
      if (regenerate) {
        setCurrentRegenerationIndex(prev => prev + 1)
      }
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("selectedModel", modelId);
  };

  const handleRetry = () => {
    console.log("Attempting to retry the last message.");
    if (messagesState.length > 1) {
      const lastMessage = messagesState[messagesState.length - 1];
      const lastUserMessage = messagesState[messagesState.length - 2];
  
      if (lastMessage.role === "user") {
        console.log("Retrying the user's message due to an error.");
        handleSubmit(lastMessage.content as string, true);
      } else if (lastMessage.role === "assistant") {
        console.log("Retrying the last user message to get a new assistant response.");
        // Store the current assistant message before regenerating
        handleSubmit(lastUserMessage.content as string, false, true);
      }
    } else {
      console.log("Not enough messages to retry.");
    }
  };

  const handleNewChatFromHere = async (index: number) => {
    try {
      const sessionId = await createChatSession(character, messages.slice(0, index + 1));
      router.push(`/chat/${character.id}?session=${sessionId}`);
      window.location.reload()
    } catch (error) {
      console.error('Failed to create chat session:', error);
    } 
  };

  const handleOnRewindHere = async (index: number) => {
    const m = await saveChat(messages.slice(0, index +1), character)
    setMessagesState(m.messages)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const handleRateMessage = async (index: number, rating: number) => {
    const newMessages = messagesState.map((msg, i) =>
      i === index ? { ...msg, rating } : msg
    );

    setMessagesState(newMessages);

    try {
      await saveChat(newMessages, character, chat_session);
    } catch (error) {
      console.error("Failed to save message rating:", error);
      toast({
        title: "Error",
        description: "Failed to save message rating. Please try again.",
        variant: "destructive",
        className: "text-xs"
      });
    }
  };

  const memoizedMessageList = useMemo(() => {
    if (messagesState.length <= 1) return null;

    return messagesState.slice(1).map((m, i) => (
      <MessageContent
        characterId={character.id}
        onRateMessage={handleRateMessage}
        showRetries={i === messagesState.length - 2}      
        key={`${m.role}-${i}`}
        userImage={persona?.image || user?.image}
        message={m as ChatMessage}
        index={i + 1}
        isUser={m.role === "user"}
        userName={persona?.displayName ?? user?.name ?? "Guest"}
        characterName={character.name}
        characterAvatarUrl={character.avatar_image_url}
        isError={error && i === messagesState.length - 2}
        onRetry={
          m.role === "assistant" &&
          i === messagesState.length - 2 &&
          messagesState.length > 2 &&
          !isLoading
            ? handleRetry
            : undefined
        }
        onEdit={handleEdit}
        onDelete={handleDelete}
        regenerations={
          m.role === "assistant" &&
          i === messagesState.length - 2 &&
          messagesState.length > 2 &&
          !isLoading
            ? regenerations
            : []
        }
        currentRegenerationIndex={currentRegenerationIndex}
        onGoBackRegenerate={handleOnGoBackRegenerate}
        onNewChatFromHere={handleNewChatFromHere}
        onRewindHere={handleOnRewindHere}
      />
    ));
  }, [
    messagesState,
    persona,
    user,
    character,
    error,
    isLoading,
    regenerations.length,
    currentRegenerationIndex,
    handleRetry,
    handleEdit,
    handleDelete,
    handleOnGoBackRegenerate,
    handleNewChatFromHere,
    handleOnRewindHere
  ]);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formRef.current) {
      const formData = new FormData(formRef.current);
      const inputValue = formData.get('message') as string;
      handleSubmit(inputValue, false, false);
      formRef.current.reset();
    }
  };

  const [processedMessages, setProcessedMessages] = useState<any>([]);
  useEffect(() => {
    const processedMessages = messagesState.map((message, index) => ({
      ...message,
      id: index.toString(), // Use index as the id
      content: replacePlaceholders(message.content as string) as string,
    })) // Ensure type includes 'id'
    setProcessedMessages(processedMessages);
  }, [messagesState]);

  return (
    <AdsProvider
      publisherToken='opencharacter-jh56hf9cl'
      isLoading={isLoading}
      messages={processedMessages}
      userId={user?.id ?? "guest"}
      conversationId={chat_session}
      isDisabled={user?.id ? PAID_USER_IDS.includes(user.id) : false}
    >
    <div className="flex flex-col h-full relative max-w-full overflow-x-hidden">
      <style jsx global>{`
        /* Webkit browsers (Chrome, Safari) */
        ::-webkit-scrollbar {
          width: 10px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        /* Firefox */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.1);
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          * {
            scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.1);
          }
        }
      `}</style>
      <div className="flex-grow w-full flex justify-center overflow-y-auto mx-auto">
        <div id="messages-container" className="w-full mx-auto max-w-2xl">
          {/* Character Information Header */}
          <div className="mx-auto pt-12 pb-6 flex flex-col gap-2 text-center items-center overflow-hidden">
            <div className={`w-24 h-24 ${localStorage.getItem('character_icon_style') === "circle" ? "rounded-full" : "rounded-lg"} overflow-hidden mr-3`}>
              <Link href={`/character/${character.id}/profile`}>
                <Image
                  src={character.avatar_image_url ?? "/default-avatar.jpg"}
                  alt={`${character.name}'s avatar`}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              </Link>
            </div>
            <p className="font-light text-md text-white">
              {character.name}
            </p>
            <ReactMarkdown className="font-light text-md text-slate-200">
              {character.tagline}
            </ReactMarkdown>
            <Link className="text-xs font-light text-gray-400 hover:underline hover:text-blue-700" href={`/public-profile/${character.userId}`}>
              by {made_by_name}
            </Link>
          </div>

          <div className="pb-32">
            {memoizedMessageList}    
            <div className="w-full mx-auto text-white flex flex-row">
              <div className="">
                <InlineAd code="inlineAd" messageId={String(processedMessages.length - 1)}/>              
              </div>
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message Input */}
      { share &&
        <Link 
          className="fixed bottom-20 md:bottom-6 left-0 right-0 px-8 py-4 max-w-lg w-full border mx-auto rounded-xl text-center text-slate-400 hover:bg-slate-900 hover:cursor-pointer bg-neutral-900"
          href={`/chat/${character.id}`}  
        >
          chat with {character.name}...
        </Link>
      }
      {!share && 
        <div className="fixed bottom-6 left-0 right-0 py-4 pointer-events-none w-full max-w-full">
        <div className="max-w-2xl mx-auto w-full">
          {error && (
            <div className="mb-2 p-2 bg-red-900 border border-red-800 rounded-lg text-red-200 text-sm pointer-events-auto flex justify-between items-center">
              <p className="flex items-center text-xs">
                <svg
                  className="w-4 h-4 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {errorMessage}, please try again
              </p>
              <RotateCcw
                className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-600 ml-2"
                onClick={handleRetry}
              />
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={handleFormSubmit}
            className="pointer-events-auto flex items-center space-x-2 max-w-full px-2"
          >
            <div className="relative flex-grow">
              <div className="absolute inset-0 bg-slate-600 bg-opacity-20 backdrop-blur-md rounded-3xl border-neutral-700"></div>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="bg-neutral-600 rounded-full p-2 transition-opacity opacity-70 hover:opacity-100 focus:opacity-100 hover:cursor-pointer"
                    >
                      <Cpu className="w-3 h-3 text-gray-300" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-96 overflow-y-auto">
                    {getModelArray().map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                        className={`flex items-center justify-between ${model.paid ? "bg-red-700" : ""} rounded-none text-xs`}
                      >
                        {model.name} {model.paid && "PREMIUM"}
                        {selectedModel === model.id && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <textarea
                ref={textareaRef}
                name="message"
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder={`Message ${character.name}...`}
                className="w-full py-4 pl-14 pr-12 bg-transparent relative z-10 outline-none text-white text-xl rounded-xl resize-none overflow-hidden"
                style={{
                  minHeight: "50px",
                  maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
                  overflowY: "auto",
                }}
                rows={1}
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 transform bg-blue-700 rounded-full -translate-y-1/2 p-2 z-20 transition-opacity opacity-70 hover:opacity-100 focus:opacity-100 hover:cursor-pointer"
                disabled={isLoading}
              >
                {!isLoading ?
                    <svg
                      viewBox="0 0 24 24"
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  :
                  <Loader2 className="w-8 h-8 animate-spin" />
                }
              </button>
            </div>
          </form>

          <Dialog
            open={isSignInDialogOpen}
            onOpenChange={setIsSignInDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign in to continue</DialogTitle>
              </DialogHeader>
              <p className="text-xs">Please sign in to send messages and save your conversation.</p>
              
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                  <input 
                    type="checkbox" 
                    checked={isAgeVerified}
                    onChange={(e) => setIsAgeVerified(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                  I confirm that I am 18 years or older
                </label>
              </div>

              {isAgeVerified ? (
                <SignInButton />
              ) : (
                <button 
                  disabled
                  className="w-full px-4 py-2 bg-gray-600 text-gray-300 rounded cursor-not-allowed opacity-50"
                >
                  Please confirm you are 18 or older
                </button>
              )}

              <p className="text-[8px] mt-2 text-slate-400">
                By signing in, you agree to our 
                <Link href="/terms-of-service" className="text-blue-500 underline"> Terms of Service</Link> and 
                <Link href="/privacy-policy" className="text-blue-500 underline"> Privacy Policy</Link>, 
                and receive emails from us about product updates, news, and promotional offers. You can unsubscribe at any time.
              </p>
            </DialogContent>
          </Dialog>

        </div>
      </div>      
      }

      {!share &&
      <Link 
        className="fixed bottom-4 text-center left-0 right-0 text-[11px] text-light text-slate-200 underline" 
        href={"/plans"}
        target="_blank"
      >
        Want access to better models?
      </Link>
      }
    </div>
    </AdsProvider>
  );
}