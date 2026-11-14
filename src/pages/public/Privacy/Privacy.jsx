// Política de Privacidade (LGPD) - TEXTO-MODELO. Revise antes de publicar.
// Ao alterar o texto, aumente TERMS_VERSION em src/constants/legal.js.
import { Link } from 'react-router'
import { useBrand } from '../../../hooks/useBrand'
import { TERMS_UPDATED_AT, TERMS_VERSION } from '../../../constants/legal'
import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import styles from '../legalPage.module.css'

export default function Privacy() {
  useDocumentTitle('Política de Privacidade', { description: 'Como o portal do bloco trata seus dados pessoais (LGPD).' })
  const brand = useBrand()
  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <h1>Política de Privacidade</h1>
        <p className={styles.updated}>
          Versão {TERMS_VERSION} · atualizado em {TERMS_UPDATED_AT}
        </p>

        <h2>1. Quem somos</h2>
        <p>
          O {brand.name} é o controlador dos dados tratados neste site, nos termos da Lei Geral de Proteção de Dados (Lei nº
          13.709/2018 - LGPD).
        </p>

        <h2>2. Dados que coletamos</h2>
        <ul>
          <li>Cadastro: nome, nome de usuário, e-mail, telefone e foto de perfil (opcional).</li>
          <li>Interações: curtidas, comentários, respostas, reações e visualizações de stories.</li>
          <li>Registro do aceite destes termos (data, hora e versão).</li>
          <li>
            Visitantes sem conta: apenas um identificador anônimo de sessão para contar visualizações de stories, sem
            identificar a pessoa.
          </li>
        </ul>

        <h2>3. Para que usamos</h2>
        <ul>
          <li>Permitir login e as interações no site;</li>
          <li>Mostrar seu nome e foto junto aos seus comentários;</li>
          <li>Enviar notificações dentro do site sobre interações com você;</li>
          <li>Manter a segurança e moderar abusos;</li>
          <li>Gerar estatísticas agregadas para a organização do bloco.</li>
        </ul>

        <h2>4. Base legal</h2>
        <p>Execução do serviço que você solicitou ao criar a conta, consentimento (aceite) e legítimo interesse em segurança.</p>

        <h2>5. Compartilhamento</h2>
        <p>
          Não vendemos seus dados. Usamos provedores de infraestrutura (hospedagem, banco de dados e envio de e-mail/SMS) que
          tratam dados apenas para operar o serviço. E-mail e telefone nunca aparecem publicamente.
        </p>

        <h2>6. Seus direitos</h2>
        <p>
          Você pode acessar e corrigir seus dados em <Link to={ROUTES.PROFILE}>Meu perfil</Link> e excluir sua conta e seus dados
          a qualquer momento na mesma página. Para outros pedidos (portabilidade, informações sobre compartilhamento), fale com a
          gente.
        </p>

        <h2>7. Retenção</h2>
        <p>
          Mantemos os dados enquanto a conta existir. Ao excluir a conta, os dados pessoais e as interações são apagados. Stories
          expirados e seus registros são removidos periodicamente.
        </p>

        <h2>8. Contato do encarregado (DPO)</h2>
        <p>[nome e e-mail do responsável pelos dados no bloco].</p>

        <p className={styles.note}>
          Texto-modelo editável. Revise com a coordenação do bloco e, se possível, com assessoria jurídica.
        </p>
      </article>
    </div>
  )
}
