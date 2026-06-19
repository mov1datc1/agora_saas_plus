import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  userFirstname: string;
}

export const WelcomeEmail = ({ userFirstname = 'Usuario' }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Bienvenido a Ágora Plus - Tu acceso PRO está listo.</Preview>
    <Tailwind>
      <Body className="bg-white my-auto mx-auto font-sans px-2">
        <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
          <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
            ¡Bienvenido a <strong>Ágora Plus</strong>!
          </Heading>
          <Text className="text-black text-[14px] leading-[24px]">
            Hola {userFirstname},
          </Text>
          <Text className="text-black text-[14px] leading-[24px]">
            Tu suscripción PRO se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos de operaciones transaccionales, M&A y el nuevo <strong>Ágora Copilot</strong> impulsado por Inteligencia Artificial.
          </Text>
          <Section className="text-center mt-[32px] mb-[32px]">
            <Button
              className="bg-[#2D8CFF] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://agora-plus.com'}/dashboard`}
            >
              Ir a mi Dashboard
            </Button>
          </Section>
          <Text className="text-black text-[14px] leading-[24px]">
            Si tienes alguna duda o sugerencia, no dudes en responder este correo. Estamos aquí para ayudarte a sacarle el máximo provecho a tus datos.
          </Text>
          <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
          <Text className="text-[#666666] text-[12px] leading-[24px]">
            © {new Date().getFullYear()} Ágora Plus. Todos los derechos reservados.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default WelcomeEmail;
