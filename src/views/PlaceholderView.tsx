import '../styles/library.css'

interface PlaceholderProps {
  title: string
  description: string
}

export function PlaceholderView({ title, description }: PlaceholderProps) {
  return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-title">{title}</div>
        <div className="empty-state-body">{description}</div>
      </div>
    </div>
  )
}
