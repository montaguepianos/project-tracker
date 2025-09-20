const BULLET_PATTERN = /^[-*•]\s+/

export type NotesContentProps = {
  value: string
}

const generateKey = (blockIndex: number, lineIndex?: number) =>
  lineIndex == null ? `block-${blockIndex}` : `block-${blockIndex}-line-${lineIndex}`

export function NotesContent({ value }: NotesContentProps) {
  const normalised = value.replace(/\r\n/g, '\n')
  const blocks = normalised
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  if (blocks.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n')
        const meaningfulLines = lines.filter((line) => line.trim().length > 0)
        const isBulletList =
          meaningfulLines.length > 0 &&
          meaningfulLines.every((line) => BULLET_PATTERN.test(line.trim()))

        if (isBulletList) {
          return (
            <ul key={generateKey(blockIndex)} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {meaningfulLines.map((line, lineIndex) => {
                const cleaned = line.trim().replace(BULLET_PATTERN, '').trimEnd()
                return <li key={generateKey(blockIndex, lineIndex)}>{cleaned}</li>
              })}
            </ul>
          )
        }

        return (
          <p key={generateKey(blockIndex)} className="whitespace-pre-line">
            {block}
          </p>
        )
      })}
    </div>
  )
}

NotesContent.displayName = 'NotesContent'
