import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/ui.store'
import { TUTORIAL_STEPS } from '@/lib/tutorial-steps'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTargetRect(selector: string): Rect | null {
  try {
    const el = document.querySelector(selector)
    if (!el) return null
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  } catch {
    return null
  }
}

const CARD_WIDTH = 360
const CARD_GAP = 12

function cardPosition(
  targetRect: Rect | null,
  cardHeight: number
): { top: number; left: number } {
  const vp = { w: window.innerWidth, h: window.innerHeight }

  if (!targetRect) {
    // Centered on screen
    return {
      top: Math.max(20, (vp.h - cardHeight) / 2),
      left: Math.max(16, (vp.w - CARD_WIDTH) / 2),
    }
  }

  // Smart positioning: if target is in bottom half, show card above; else below
  const targetMidY = targetRect.top + targetRect.height / 2
  const inBottomHalf = targetMidY > vp.h / 2

  let top: number
  let left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2

  if (inBottomHalf) {
    // Show above
    top = targetRect.top - cardHeight - CARD_GAP
  } else {
    // Show below
    top = targetRect.top + targetRect.height + CARD_GAP
  }

  // Clamp within viewport with padding
  top = Math.max(16, Math.min(top, vp.h - cardHeight - 16))
  left = Math.max(16, Math.min(left, vp.w - CARD_WIDTH - 16))

  return { top, left }
}

// ── Spotlight ring ────────────────────────────────────────────────────────────

function SpotlightRing({ rect }: { rect: Rect }) {
  const PAD = 6
  return (
    <motion.div
      key={`ring-${rect.top}-${rect.left}`}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{
        opacity: 1,
        scale: [1, 1.02, 1],
      }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
      }}
      style={{
        position: 'fixed',
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        borderRadius: 8,
        boxShadow:
          '0 0 0 4px var(--color-primary), 0 0 0 9999px rgba(0,0,0,0.55)',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({
  total,
  current,
}: {
  total: number
  current: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="block rounded-full transition-all duration-300"
          style={{
            width: i === current ? 16 : 6,
            height: 6,
            background:
              i <= current
                ? 'var(--color-primary)'
                : 'var(--color-border)',
          }}
        />
      ))}
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function TutorialOverlay() {
  const {
    tutorialOpen,
    tutorialStep,
    tutorialCompleted: _completed,
    setTutorialOpen,
    setTutorialStep,
    setTutorialCompleted,
  } = useUIStore()

  const navigate = useNavigate()

  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 })
  const [direction, setDirection] = useState<1 | -1>(1) // 1 = forward, -1 = back
  const [isNavigating, setIsNavigating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const step = TUTORIAL_STEPS[tutorialStep]
  const total = TUTORIAL_STEPS.length
  const isFirst = tutorialStep === 0
  const isLast = tutorialStep === total - 1

  // Navigate to /app/today when tutorial opens at step 0
  useEffect(() => {
    if (tutorialOpen && tutorialStep === 0) {
      navigate('/app/today')
    }
  }, [tutorialOpen, tutorialStep, navigate])

  // When step changes: navigate if needed, then wait for render, then measure target
  useEffect(() => {
    if (!tutorialOpen || !step) return

    let cancelled = false

    async function resolveStep() {
      setIsNavigating(true)
      setTargetRect(null)

      // Navigate to the step's route if specified
      if (step.route) {
        navigate(step.route)
        // Wait for navigation + render to complete
        await new Promise((r) => setTimeout(r, 400))
      }

      if (cancelled) return

      // Extra wait for page to paint
      await new Promise((r) => setTimeout(r, 300))

      if (cancelled) return

      const rect = step.target ? getTargetRect(step.target) : null

      // After scrollIntoView we need to wait a frame for the scroll to settle
      // then re-read the bounding rect
      if (rect && step.target) {
        await new Promise((r) => setTimeout(r, 150))
        if (cancelled) return
        try {
          const el = document.querySelector(step.target)
          if (el) {
            const r = el.getBoundingClientRect()
            setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
          } else {
            setTargetRect(null)
          }
        } catch {
          setTargetRect(null)
        }
      } else {
        setTargetRect(rect)
      }

      setIsNavigating(false)
    }

    void resolveStep()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialOpen, tutorialStep])

  // Reposition card whenever targetRect or cardRef size changes
  useEffect(() => {
    if (!tutorialOpen) return
    const cardHeight = cardRef.current?.offsetHeight ?? 200
    setCardPos(cardPosition(targetRect, cardHeight))
  }, [tutorialOpen, targetRect])

  // Recompute on window resize
  useEffect(() => {
    if (!tutorialOpen) return

    const onResize = () => {
      if (!step?.target) {
        setTargetRect(null)
        return
      }
      try {
        const el = document.querySelector(step.target)
        if (el) {
          const r = el.getBoundingClientRect()
          setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tutorialOpen, step])

  async function handleNext() {
    setDirection(1)
    if (isLast) {
      setTutorialCompleted(true)
      setTutorialOpen(false)
    } else {
      setTutorialStep(tutorialStep + 1)
    }
  }

  function handlePrev() {
    setDirection(-1)
    setTutorialStep(tutorialStep - 1)
  }

  function handleSkip() {
    setTutorialOpen(false)
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  }

  if (!tutorialOpen) return null

  return (
    <>
      {/* Backdrop — shown only when there is no spotlight (spotlight provides its own shadow overlay) */}
      {!targetRect && !isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 bg-black/60 z-[9997]"
          onClick={handleSkip}
        />
      )}

      {/* Spotlight ring around target */}
      <AnimatePresence>
        {targetRect && !isNavigating && <SpotlightRing rect={targetRect} />}
      </AnimatePresence>

      {/* Floating card */}
      <div
        style={{
          position: 'fixed',
          top: cardPos.top,
          left: cardPos.left,
          width: CARD_WIDTH,
          zIndex: 10001,
          pointerEvents: isNavigating ? 'none' : 'auto',
          opacity: isNavigating ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={tutorialStep}
            ref={cardRef}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl shadow-xl p-5 space-y-4"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-fg)',
            }}
          >
            {/* Step counter */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                Paso {tutorialStep + 1} de {total}
              </span>
              <button
                onClick={handleSkip}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-fg-muted)' }}
                aria-label="Saltar tutorial"
              >
                Saltar ×
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--color-fg)' }}>
                {step.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-fg-muted)' }}>
                {step.description}
              </p>
            </div>

            {/* Progress dots */}
            <ProgressDots total={total} current={tutorialStep} />

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Left side: Anterior */}
              <div>
                {!isFirst && (
                  <button
                    onClick={handlePrev}
                    disabled={isNavigating}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{
                      background: 'var(--color-bg-subtle)',
                      color: 'var(--color-fg)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Anterior
                  </button>
                )}
              </div>

              {/* Right side: Siguiente / Empezar */}
              <button
                onClick={handleNext}
                disabled={isNavigating}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                }}
              >
                {isLast ? '¡Empezar!' : 'Siguiente →'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
