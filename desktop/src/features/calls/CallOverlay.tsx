import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage, Button, Tooltip, initialsOf } from '@/components/ui'
import { callEngine } from '@/features/calls/call-engine'
import { useCallStreams } from '@/features/calls/use-call-streams'
import { useDirectory } from '@/hooks/use-users'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/calls'

/** Rebinds a MediaStream to a <video> whenever it changes identity. */
function useStreamRef(stream: MediaStream | null) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.srcObject = stream
    if (stream) void element.play().catch(() => undefined)
  }, [stream])
  return ref
}

function CallTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])
  return <span className="tabular-nums">{formatDuration(now - startedAt)}</span>
}

const PHASE_LABEL: Record<string, string> = {
  'ringing-out': 'Ringing…',
  'ringing-in': 'Incoming…',
  connecting: 'Connecting…',
  active: 'Connected',
  ended: 'Call ended',
}

/**
 * The in-call surface: full window for video, a compact card for audio.
 *
 * Rendered above the app rather than as a route, so navigating between chats
 * during a call never tears down the peer connection.
 */
export function CallOverlay() {
  const call = useCallStore((state) => state.call)
  const micEnabled = useCallStore((state) => state.micEnabled)
  const cameraEnabled = useCallStore((state) => state.cameraEnabled)
  const { local, remote } = useCallStreams()
  const { byId } = useDirectory()

  const localRef = useStreamRef(local)
  const remoteRef = useStreamRef(remote)

  if (!call || call.phase === 'ringing-in') return null

  const peer = call.peerId ? byId.get(call.peerId) : undefined
  const name = peer?.fullName ?? 'Call'
  const isVideo = call.callType === 'video'
  const showRemoteVideo = isVideo && Boolean(remote)

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
      <div
        className={cn(
          'relative flex flex-col items-center justify-center overflow-hidden rounded-2xl',
          showRemoteVideo ? 'h-[78vh] w-[80vw] bg-black' : 'glass-floating w-80 gap-4 px-6 py-8',
        )}
      >
        {showRemoteVideo ? (
          <video ref={remoteRef} autoPlay playsInline className="size-full object-cover" />
        ) : (
          <>
            <Avatar className="size-24">
              {peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-2xl">{initialsOf(name)}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{name}</p>
              <p className="text-muted-foreground text-[13px]">
                {call.phase === 'active' && call.startedAt ? (
                  <CallTimer startedAt={call.startedAt} />
                ) : (
                  (call.endReason ?? PHASE_LABEL[call.phase] ?? '')
                )}
              </p>
            </div>
          </>
        )}

        {isVideo && local ? (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute rounded-xl border border-white/15 object-cover shadow-lg',
              showRemoteVideo ? 'right-4 bottom-4 h-36 w-52' : 'inset-0 size-full',
            )}
          />
        ) : null}

        {showRemoteVideo ? (
          <div className="absolute top-4 left-4 rounded-full bg-black/50 px-3 py-1 text-[13px] text-white">
            {name}
            {call.phase === 'active' && call.startedAt ? (
              <>
                {' · '}
                <CallTimer startedAt={call.startedAt} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Tooltip content={micEnabled ? 'Mute' : 'Unmute'}>
          <Button
            size="icon"
            variant={micEnabled ? 'secondary' : 'destructive'}
            className="size-12"
            aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            onClick={() => callEngine.toggleMic()}
          >
            {micEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Button>
        </Tooltip>

        {isVideo ? (
          <Tooltip content={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>
            <Button
              size="icon"
              variant={cameraEnabled ? 'secondary' : 'destructive'}
              className="size-12"
              aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              onClick={() => callEngine.toggleCamera()}
            >
              {cameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </Button>
          </Tooltip>
        ) : null}

        <Tooltip content="End call">
          <Button
            size="icon"
            variant="destructive"
            className="size-14"
            aria-label="End call"
            onClick={() => callEngine.hangUp()}
          >
            <PhoneOff className="size-6" />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
