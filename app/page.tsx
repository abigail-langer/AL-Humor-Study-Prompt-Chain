import AuthGate from '@/components/AuthGate'
import ImageDescriptionTool from '@/components/ImageDescriptionTool'
import PromptChainBuilder from '@/components/PromptChainBuilder'

export default function Home() {
  return (
    <AuthGate>
      <ImageDescriptionTool />
      <PromptChainBuilder />
    </AuthGate>
  )
}
