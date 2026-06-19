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

interface DunningEmailProps {
  userFirstname: string;
}

export const DunningEmail = ({ userFirstname = 'Usuario' }: DunningEmailProps) => (
  <Html>
    <Head />
    <Preview>Acción Requerida: Actualiza tu método de pago en Ágora Plus</Preview>
    <Tailwind>
      <Body className="bg-white my-auto mx-auto font-sans px-2">
        <Container className="border border-solid border-[#ffdddd] bg-[#fffbfb] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
          <Heading className="text-[#d32f2f] text-[24px] font-normal text-center p-0 my-[30px] mx-0">
            Hubo un problema con tu pago
          </Heading>
          <Text className="text-black text-[14px] leading-[24px]">
            Hola {userFirstname},
          </Text>
          <Text className="text-black text-[14px] leading-[24px]">
            No pudimos procesar el último cargo de tu suscripción a <strong>Ágora Plus</strong>. Para evitar interrupciones en tu acceso a la plataforma y al Copilot, por favor actualiza tu tarjeta o método de pago a la brevedad.
          </Text>
          <Section className="text-center mt-[32px] mb-[32px]">
            <Button
              className="bg-[#d32f2f] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://agora-plus.com'}/dashboard/billing`}
            >
              Actualizar Método de Pago
            </Button>
          </Section>
          <Text className="text-black text-[14px] leading-[24px]">
            Si ya actualizaste tu información recientemente, puedes ignorar este mensaje.
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

export default DunningEmail;
