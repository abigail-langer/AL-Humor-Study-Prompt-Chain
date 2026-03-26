import ImageDescriptionTool from '@/components/ImageDescriptionTool'
import PromptChainBuilder from '@/components/PromptChainBuilder'
import SignOutButton from '@/components/SignOutButton'

export default function Home() {
  return (
    <>
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-6 py-3">
        <SignOutButton />
      </div>
      <ImageDescriptionTool />
      <PromptChainBuilder />
    </>
  )
}
