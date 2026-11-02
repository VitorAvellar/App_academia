import type { Exercise } from '../db/types'

interface Props {
  exercise: Pick<Exercise, 'name' | 'imagePath'>
  className?: string
}

/**
 * Imagem do exercício (arquivo local em public/exercise-images, funciona offline).
 * Sem imagem, mostra um quadrado com a inicial do nome.
 */
export function ExerciseImage({ exercise, className = 'h-14 w-14' }: Props) {
  if (!exercise.imagePath) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg font-bold text-slate-500`}
        aria-hidden
      >
        {exercise.name.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}${exercise.imagePath}`}
      alt={exercise.name}
      loading="lazy"
      className={`${className} shrink-0 rounded-lg bg-white object-cover`}
    />
  )
}

