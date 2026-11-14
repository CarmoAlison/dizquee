// Login por telefone: envia código por SMS e confirma (Supabase Auth OTP)
import { useEffect, useState } from 'react'
import { sendPhoneOtp, verifyPhoneOtp } from '../../../services/authService'
import { getErrorMessage } from '../../../utils/errors'
import { formatPhone, normalizePhone, validatePhone } from '../../../utils/validators'
import { Button } from '../../common/Button/Button'
import { Input } from '../../common/Input/Input'
import styles from '../LoginForm/LoginForm.module.css'

const RESEND_SECONDS = 60

export function PhoneOtpForm({ onSuccess, onBack }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return undefined
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const send = async (e) => {
    e?.preventDefault()
    const phoneError = validatePhone(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }
    setLoading(true)
    setError('')
    try {
      await sendPhoneOtp(normalizePhone(phone))
      setStep('code')
      setCountdown(RESEND_SECONDS)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar o código.'))
    } finally {
      setLoading(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    if (code.length < 6) {
      setError('Digite o código de 6 dígitos.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await verifyPhoneOtp(normalizePhone(phone), code)
      onSuccess?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Código inválido.'))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'code') {
    return (
      <form className={styles.form} onSubmit={verify} noValidate>
        <p className={styles.helper}>
          Enviamos um código por SMS para <strong>{formatPhone(normalizePhone(phone))}</strong>.
        </p>
        <Input
          label="Código de verificação"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={error}
          data-autofocus
          required
        />
        <Button type="submit" fullWidth loading={loading}>
          Confirmar e entrar
        </Button>
        <div className={styles.row}>
          <button type="button" className={styles.textButton} onClick={() => setStep('phone')}>
            Trocar número
          </button>
          <button type="button" className={styles.textButton} onClick={send} disabled={countdown > 0 || loading}>
            {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={send} noValidate>
      <Input
        label="Telefone com DDD"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(11) 91234-5678"
        autoComplete="tel"
        inputMode="tel"
        hint="Você receberá um código por SMS."
        error={error}
        required
      />
      <Button type="submit" fullWidth loading={loading}>
        Enviar código
      </Button>
      {onBack && (
        <button type="button" className={styles.textButton} onClick={onBack}>
          Voltar para e-mail e senha
        </button>
      )}
    </form>
  )
}
