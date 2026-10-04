import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '../components/Container'
import { PRIVACY_POLICY_LAST_UPDATED, PRIVACY_POLICY_VERSION } from '../services/privacyPolicy'

// Highlighted on purpose: these must be filled in by AK Talent before launch.
function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-amber-100 px-1 font-semibold text-ink-950">{children}</mark>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink-950 sm:text-2xl">{title}</h2>
      <div className="mt-3 grid gap-3 text-base leading-7 text-ink-700">{children}</div>
    </section>
  )
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-2 pl-5 [list-style:disc]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

export function PrivacyPage() {
  const contactEmail = <Placeholder>[E-MAIL DE CONTATO DE PRIVACIDADE]</Placeholder>

  return (
    <Container className="py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-800">LGPD</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ink-950 sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-4 text-sm text-ink-600">
          Última atualização: {PRIVACY_POLICY_LAST_UPDATED} · Versão {PRIVACY_POLICY_VERSION}
        </p>
        <p className="mt-6 text-lg leading-8 text-ink-700">
          Esta política explica, em linguagem simples, quais dados pessoais a AK Talent coleta, por que coleta, com quem
          compartilha e como você pode exercer seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>

        <Section title="1. Quem somos">
          <p>
            A AK Talent é operada por <Placeholder>[RAZÃO SOCIAL]</Placeholder>, inscrita no CNPJ sob o nº{' '}
            <Placeholder>[CNPJ]</Placeholder>. Somos uma empresa de recrutamento: nossa equipe conduz processos seletivos
            para empresas clientes usando a plataforma AK Talent. Somos responsáveis (controladores) pelos dados tratados
            nesta plataforma.
          </p>
          <p>Para qualquer assunto sobre seus dados, fale com a gente pelo e-mail {contactEmail}.</p>
        </Section>

        <Section title="2. Quais dados coletamos">
          <p>
            <strong>Candidatos que se candidatam pelo site:</strong> nome completo, e-mail, telefone/WhatsApp, cidade e
            bairro, as respostas da triagem da vaga e as mensagens que você escrever no chat.
          </p>
          <p>
            <strong>Candidatos com conta:</strong> nome, e-mail e senha (guardada de forma criptografada), e os dados que
            você escolher preencher no perfil: telefone, cidade, estado, cargo desejado, resumo profissional, habilidades,
            anos de experiência, pretensão salarial, modelo de trabalho, LinkedIn e portfólio.
          </p>
          <p>
            <strong>Empresas:</strong> nome da empresa, nome do responsável, e-mail, telefone, cidade, estado, segmento,
            porte, site, descrição e os dados das vagas publicadas.
          </p>
          <p>
            <strong>Dados técnicos:</strong> o endereço IP de quem acessa, usado para segurança (por exemplo, para limitar
            tentativas repetidas de login). Para manter você conectado, guardamos no seu navegador apenas os dados da sua
            sessão. Não usamos ferramentas de publicidade nem de rastreamento.
          </p>
        </Section>

        <Section title="3. Para que usamos seus dados">
          <List
            items={[
              'Conduzir processos seletivos: analisar candidaturas, organizar a triagem e entrar em contato sobre as vagas.',
              'Criar e manter as contas de candidatos e empresas na plataforma.',
              'Apresentar candidatos às empresas clientes nas vagas em que eles se candidataram.',
              'Manter a plataforma segura e prevenir fraudes e abusos.',
              'Cumprir obrigações legais e responder a autoridades quando a lei exigir.',
            ]}
          />
          <p>
            A triagem inicial de uma vaga pode usar regras automáticas definidas para aquela vaga (por exemplo, disponibilidade
            de horário). A decisão sobre seguir ou não no processo é sempre tomada por pessoas da nossa equipe ou da empresa
            contratante, e você pode pedir a revisão de qualquer resultado.
          </p>
          <p>
            Tratamos seus dados com base no seu consentimento, na execução de procedimentos ligados ao processo seletivo que
            você pediu para participar, no nosso legítimo interesse em manter a plataforma segura e no cumprimento de
            obrigações legais.
          </p>
        </Section>

        <Section title="4. Com quem compartilhamos">
          <p>Nunca vendemos seus dados. Compartilhamos apenas o necessário com:</p>
          <List
            items={[
              <>
                <strong>Empresas clientes:</strong> a empresa que abriu a vaga em que você se candidatou pode receber seus dados
                profissionais e de contato para conduzir o processo seletivo.
              </>,
              <>
                <strong>AppIntelli:</strong> fornecedora do chat do site e da triagem por conversa. Ela recebe as mensagens que
                você escreve no chat. Sua candidatura é identificada por um código; nome, e-mail e telefone não são enviados
                automaticamente.
              </>,
              <>
                <strong>OpenAI:</strong> quando você usa os assistentes de IA da plataforma (sugestões de perfil para candidatos
                e de texto de vaga para empresas), as informações digitadas nesses assistentes são enviadas à OpenAI para gerar
                a sugestão. Os dados de candidatura enviados pelo site não são enviados à OpenAI.
              </>,
              <>
                <strong>Hospedagem e infraestrutura:</strong> Render (servidor e banco de dados) e Vercel (site). O site também
                carrega fontes do Google Fonts, o que faz seu navegador se conectar aos servidores do Google.
              </>,
              <>
                <strong>Autoridades públicas:</strong> somente quando a lei ou uma ordem judicial exigir.
              </>,
            ]}
          />
          <p>
            Alguns desses fornecedores mantêm servidores fora do Brasil. Nesses casos, a transferência internacional ocorre
            para a prestação do serviço e com as garantias previstas na LGPD.
          </p>
        </Section>

        <Section title="5. Por quanto tempo guardamos">
          <p>
            Guardamos os dados de candidatura por <Placeholder>[PRAZO DE RETENÇÃO]</Placeholder> após o fim do processo
            seletivo, para que você possa ser considerado em novas vagas parecidas. Dados de contas ficam guardados enquanto a
            conta existir. Depois desses prazos, os dados são apagados ou anonimizados, exceto quando a lei exigir que sejam
            mantidos por mais tempo.
          </p>
        </Section>

        <Section title="6. Seus direitos">
          <p>Pela LGPD, você pode, a qualquer momento:</p>
          <List
            items={[
              'Confirmar se tratamos seus dados e ter acesso a eles.',
              'Corrigir dados incompletos, errados ou desatualizados.',
              'Pedir que dados desnecessários ou tratados em desacordo com a lei sejam anonimizados, bloqueados ou apagados.',
              'Pedir a portabilidade dos seus dados para outro fornecedor.',
              'Saber com quem compartilhamos seus dados.',
              'Revogar seu consentimento e pedir a exclusão dos dados tratados com base nele.',
              'Pedir a revisão de decisões tomadas apenas com base em tratamento automatizado.',
              'Reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
            ]}
          />
        </Section>

        <Section title="7. Como exercer seus direitos">
          <p>
            Envie um e-mail para {contactEmail} dizendo o que você precisa. Para proteger seus dados, podemos pedir uma
            confirmação de identidade. Respondemos em até 15 dias.
          </p>
        </Section>

        <Section title="8. Como protegemos seus dados">
          <p>
            Usamos conexão segura (HTTPS), senhas guardadas de forma criptografada, acesso restrito à equipe que precisa dos
            dados e limites contra tentativas repetidas de acesso. Nenhum sistema é totalmente imune a incidentes; se algo
            acontecer que possa trazer risco a você, avisaremos você e a ANPD conforme a lei.
          </p>
        </Section>

        <Section title="9. Mudanças nesta política">
          <p>
            Podemos atualizar esta política. A data e a versão no topo desta página mostram a última atualização. Quando a
            mudança for importante, avisaremos pelos nossos canais.
          </p>
        </Section>

        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-ink-600">
          Dúvidas? Escreva para {contactEmail}.{' '}
          <Link to="/" className="font-semibold text-gold-800 hover:text-ink-950">
            Voltar para o início
          </Link>
        </p>
      </article>
    </Container>
  )
}
