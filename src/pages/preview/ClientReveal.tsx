import CharacterReveal from '@/components/CharacterReveal';

export default function PreviewClientReveal() {
  return (
    <div className="h-dvh bg-background">
      <CharacterReveal colorIndex={2} isEagle={false} />
    </div>
  );
}
