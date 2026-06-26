import ReactMarkdown from 'react-markdown';
import { Mic, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-white">AI</span>
        </div>
      )}
      <div className={cn('max-w-[82%]', isUser && 'items-end flex flex-col')}>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-white border border-border text-foreground rounded-tl-sm shadow-sm'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        <div className={cn('flex items-center gap-1 mt-0.5 px-1', isUser ? 'justify-end' : 'justify-start')}>
          {isUser && message.input_method === 'voice' && <Mic className="w-2.5 h-2.5 text-muted-foreground" />}
          {isUser && message.input_method === 'text' && <Type className="w-2.5 h-2.5 text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground">
            {message.created_date ? formatDistanceToNow(new Date(message.created_date), { addSuffix: true }) : 'just now'}
          </span>
        </div>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-muted-foreground">You</span>
        </div>
      )}
    </div>
  );
}