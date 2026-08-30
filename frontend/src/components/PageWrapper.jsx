/**
 * PageWrapper for page-level components.
 * Does NOT add top padding — MainLayout handles that via pt-16/pt-20.
 */
export default function PageWrapper({ children, className = '' }) {
  return (
    <div className={`w-full ${className}`}>
      {children}
    </div>
  )
}
