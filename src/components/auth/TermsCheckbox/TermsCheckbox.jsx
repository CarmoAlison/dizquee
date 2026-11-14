// Aceite obrigatório (LGPD) dos Termos de Uso e da Política de Privacidade
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { Checkbox } from '../../common/Checkbox/Checkbox'

export function TermsCheckbox({ checked, onChange, error }) {
  return (
    <Checkbox
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      error={error}
      required
      label={
        <>
          Li e aceito os{' '}
          <Link to={ROUTES.TERMS} target="_blank" rel="noopener">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link to={ROUTES.PRIVACY} target="_blank" rel="noopener">
            Política de Privacidade
          </Link>
          .
        </>
      }
    />
  )
}
