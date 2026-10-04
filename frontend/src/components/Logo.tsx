import { Link } from 'react-router-dom'
import logoImage from '../assets/ak-talent-logo.png'

interface LogoProps {
  className?: string
}

// Official AK Talent mark (asset cropped from the brand file, background made transparent).
export function Logo({ className = 'h-12 lg:h-13' }: LogoProps) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="AK Talent - página inicial">
      <img src={logoImage} alt="AK Talent" width={306} height={146} className={`w-auto ${className}`} />
    </Link>
  )
}
