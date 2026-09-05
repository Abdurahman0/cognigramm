import { Phone, PhoneOff, Video } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  initialsOf,
} from '@/components/ui'
import { callEngine } from '@/features/calls/call-engine'
import { useDirectory } from '@/hooks/use-users'
import { useCallStore } from '@/stores/calls'

/** The ringing screen for an inbound call. */
export function IncomingCallDialog() {
  const call = useCallStore((state) => state.call)
  const { byId } = useDirectory()

  const open = call?.phase === 'ringing-in'
  const caller = call?.peerId ? byId.get(call.peerId) : undefined
  const name = caller?.fullName ?? 'Incoming call'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && callEngine.reject()}>
      <DialogContent className="max-w-xs text-center">
        <div className="flex flex-col items-center gap-3 pt-2">
          <Avatar className="size-20">
            {caller?.avatarUrl ? <AvatarImage src={caller.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xl">{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle className="text-lg">{name}</DialogTitle>
            <DialogDescription className="mt-1 flex items-center justify-center gap-1.5">
              {call?.callType === 'video' ? (
                <Video className="size-3.5" />
              ) : (
                <Phone className="size-3.5" />
              )}
              Incoming {call?.callType} call
            </DialogDescription>
          </div>
        </div>

        <div className="mt-2 flex justify-center gap-3">
          <Button
            size="icon"
            variant="destructive"
            className="size-12"
            aria-label="Decline"
            onClick={() => callEngine.reject()}
          >
            <PhoneOff className="size-5" />
          </Button>
          <Button
            size="icon"
            className="bg-success size-12"
            aria-label="Answer"
            onClick={() => void callEngine.accept()}
          >
            <Phone className="size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
