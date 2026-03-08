interface Props {
  size?: number
}

export function CoinIcon({ size = 20 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9.5" fill="#F59E0B" stroke="#B45309" strokeWidth="1"/>
      <circle cx="10" cy="10" r="7" fill="#FCD34D" opacity="0.6"/>
      <text x="10" y="14.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#78350F" fontFamily="serif">$</text>
    </svg>
  )
}
