// Termos de Uso - TEXTO-MODELO. Revise com assessoria jurídica antes de publicar.
// Ao alterar o texto, aumente TERMS_VERSION em src/constants/legal.js.
import { Link } from 'react-router'
import { useBrand } from '../../../hooks/useBrand'
import { TERMS_UPDATED_AT, TERMS_VERSION } from '../../../constants/legal'
import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import styles from '../legalPage.module.css'

export default function Terms() {
  useDocumentTitle('Termos de Uso', { description: 'Termos de Uso do portal do bloco.' })
  const brand = useBrand()
  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <h1>Termos de Uso</h1>
        <p className={styles.updated}>
          Versão {TERMS_VERSION} · atualizado em {TERMS_UPDATED_AT}
        </p>

        <h2>1. Sobre o serviço</h2>
        <p>
          O site do {brand.name} reúne novidades, fotos, vídeos e stories do bloco. Visitantes podem ver o conteúdo público;
          quem cria uma conta pode curtir, comentar, responder e reagir.
        </p>

        <h2>2. Cadastro</h2>
        <ul>
          <li>Você deve informar dados verdadeiros e manter seu cadastro atualizado.</li>
          <li>O nome de usuário é único e não pode imitar outra pessoa ou o próprio bloco.</li>
          <li>Você é responsável por manter sua senha em segurança.</li>
        </ul>

        <h2>3. Regras de convivência</h2>
        <p>Não são permitidos comentários ou reações que:</p>
        <ul>
          <li>ofendam, discriminem, ameacem ou assediem qualquer pessoa;</li>
          <li>divulguem dados pessoais de terceiros;</li>
          <li>contenham spam, golpes, propaganda não autorizada ou conteúdo ilegal.</li>
        </ul>
        <p>
          A organização do bloco pode remover comentários e suspender (banir) contas que descumpram estas regras, informando o
          motivo.
        </p>

        <h2>4. Conteúdo do bloco</h2>
        <p>
          Fotos, vídeos, textos e marcas publicados pelo bloco pertencem ao {brand.name} ou a seus autores. Compartilhar os links
          é permitido; reproduzir o conteúdo para fins comerciais depende de autorização.
        </p>

        <h2>5. Exclusão da conta</h2>
        <p>
          Você pode excluir sua conta a qualquer momento na página <Link to={ROUTES.PROFILE}>Meu perfil</Link>. Seus dados
          pessoais e interações serão apagados, conforme a <Link to={ROUTES.PRIVACY}>Política de Privacidade</Link>.
        </p>

        <h2>6. Alterações</h2>
        <p>
          Estes termos podem ser atualizados. Quando isso acontecer, pediremos que você leia e aceite a nova versão para
          continuar interagindo.
        </p>

        <h2>7. Contato</h2>
        <p>Dúvidas: [e-mail de contato do bloco].</p>

        <p className={styles.note}>
          Texto-modelo editável. Revise com a coordenação do bloco e, se possível, com assessoria jurídica.
        </p>
      </article>
    </div>
  )
}
