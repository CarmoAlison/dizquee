import { useState } from 'react'
import { Icon } from '../../common/Icon/Icon'
import { Input } from '../../common/Input/Input'
import styles from './PasswordInput.module.css'

export function PasswordInput(props) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
        </button>
      }
    />
  )
}
