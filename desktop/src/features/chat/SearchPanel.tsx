import { Search } from 'lucide-react'
import { useState } from 'react'

import { Input, Spinner } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMessageSearch } from '@/hooks/use-messages'
import { formatListTime } from '@/lib/format'

/** Full-text search inside one conversation, backed by the server's index. */
export function SearchPanel({
  conversationId,
  onJumpTo,
}: {
  conversationId: number
  onJumpTo: (messageId: number) => void
}) {
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term, 300)
  const { data: results, isFetching } = useMessageSearch(conversationId, debounced)

  return (
    <div className="border-border/60 bg-input/40 border-b p-2">
      <div className="relative">
        <Search className="text-faint-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search in this conversation"
          className="h-9 pl-8 text-[13px]"
          autoFocus
        />
        {isFetching ? (
          <Spinner className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2" />
        ) : null}
      </div>

      {debounced.trim().length >= 2 ? (
        <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {results && results.length > 0 ? (
            results.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => onJumpTo(message.id)}
                className="hover:bg-accent/60 flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[13px]">{message.body}</span>
                <span className="text-faint-foreground shrink-0 text-[11px]">
                  {formatListTime(message.createdAt)}
                </span>
              </button>
            ))
          ) : (
            <p className="text-muted-foreground px-2 py-3 text-center text-[12px]">
              {isFetching ? 'Searching…' : 'No matches.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
