/**
 * Boletín de demostración para probar Comunicación Interna + SES.
 * Es intencionalmente idempotente: si ya fue editado, una nueva ejecución no lo pisa.
 */
import { NewsletterStatus, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'boletin-prueba-ti';
const MALI_LOGO =
  'https://mali.pe/es/wp-content/uploads/2025/06/MALI_Institucional_blanco_Web_566x365.png';
const MALI_ONE_LOGO = 'https://dev.mali.pe/icons/pwa-192.png';
const HERO_IMAGE =
  'https://mali.pe/es/wp-content/uploads/2025/09/Bannersweb-01-1118x400.jpg';
const DIGITAL_ART_IMAGE =
  'https://mali.pe/es/wp-content/uploads/2025/07/PackPrincipalMundo_Expandido_Final-07-1080x360-1-1024x341.jpg';

const htmlBody = `
<style>
  @media only screen and (max-width: 640px) {
    .email-shell { width: 100% !important; }
    .mobile-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .hero-title { font-size: 44px !important; line-height: 0.98 !important; }
    .metric { display: block !important; width: 100% !important; border-right: 0 !important; border-bottom: 1px solid #34343a !important; }
    .benefit-number { width: 54px !important; font-size: 28px !important; }
  }
</style>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Una prueba real del nuevo motor de comunicaciones de MALI ONE.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f0eee8;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" class="email-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px;background:#ffffff;border-collapse:collapse;box-shadow:0 18px 50px rgba(17,17,17,.12);">
          <tr>
            <td style="background:#111114;padding:14px 38px;border-bottom:1px solid #34343a;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle">
                    <img src="${MALI_LOGO}" width="70" alt="MALI - Museo de Arte de Lima" style="display:block;width:70px;height:auto;border:0;">
                  </td>
                  <td align="right" valign="middle">
                    <table role="presentation" align="right" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td valign="middle" style="padding-right:9px;"><img src="${MALI_ONE_LOGO}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border:0;border-radius:7px;"></td>
                        <td valign="middle" style="font-size:13px;line-height:1;font-weight:800;letter-spacing:1.8px;color:#ffffff;">MALI ONE</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="background:#111114;padding:62px 54px 52px;font-family:Arial,Helvetica,sans-serif;">
              <div style="margin:0 0 20px;font-size:11px;line-height:1.3;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#ff3d9a;">Boletín de prueba</div>
              <h1 class="hero-title" style="margin:0;max-width:520px;font-family:Georgia,'Times New Roman',serif;font-size:68px;line-height:.94;font-weight:400;letter-spacing:-2.8px;color:#ffffff;">MALI <em style="color:#a7f3df;font-weight:400;">ONE</em></h1>
              <div style="width:74px;height:6px;margin:28px 0 26px;background:#ff3d9a;"></div>
              <p style="margin:0;max-width:480px;font-size:18px;line-height:1.6;color:#d7d7dc;">Una nueva forma de crear, enviar y conocer el alcance de nuestras comunicaciones.</p>
            </td>
          </tr>

          <tr>
            <td style="background:#111114;">
              <img src="${HERO_IMAGE}" width="640" alt="Fachada del Museo de Arte de Lima - MALI" style="display:block;width:100%;max-width:640px;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:50px 54px 30px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;line-height:1.3;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#e2187d;">Creado para el equipo MALI</div>
              <h2 style="margin:12px 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;letter-spacing:-.7px;color:#17171a;">Una forma más simple de comunicarnos.</h2>
              <p style="margin:0;font-size:16px;line-height:1.75;color:#55555d;">Este mensaje fue creado y enviado desde MALI ONE, nuestra alternativa a Mailchimp. En una sola herramienta podemos preparar el boletín, elegir a quién enviarlo y revisar sus resultados.</p>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:8px 54px 34px;background:#ffffff;">
              <img src="${DIGITAL_ART_IMAGE}" width="532" alt="Arte, mundo físico y mundo digital en el MALI" style="display:block;width:100%;max-width:532px;height:auto;border:0;">
              <div style="padding:11px 14px;background:#f0eee8;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5;letter-spacing:.8px;text-transform:uppercase;color:#66666e;">Con tecnología propia, el MALI amplía el alcance de sus comunicaciones.</div>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:18px 54px 42px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td class="benefit-number" width="72" valign="top" style="width:72px;padding:22px 12px 22px 0;border-top:1px solid #dedbd3;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1;color:#e2187d;">01</td>
                  <td valign="top" style="padding:20px 0;border-top:1px solid #dedbd3;">
                    <h3 style="margin:0 0 7px;font-size:16px;line-height:1.35;font-weight:800;color:#17171a;">Llegamos a más personas</h3>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#606068;">Podemos enviar hasta <strong>50,000 correos al día</strong> para informar a nuestras distintas audiencias.</p>
                  </td>
                </tr>
                <tr>
                  <td class="benefit-number" width="72" valign="top" style="width:72px;padding:22px 12px 22px 0;border-top:1px solid #dedbd3;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1;color:#e2187d;">02</td>
                  <td valign="top" style="padding:20px 0;border-top:1px solid #dedbd3;">
                    <h3 style="margin:0 0 7px;font-size:16px;line-height:1.35;font-weight:800;color:#17171a;">Ahorramos en cada envío</h3>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#606068;">Pagamos solo por los correos que enviamos. Según el volumen, el ahorro puede acercarse al <strong>60% frente a Mailchimp</strong>.</p>
                  </td>
                </tr>
                <tr>
                  <td class="benefit-number" width="72" valign="top" style="width:72px;padding:22px 12px 22px 0;border-top:1px solid #dedbd3;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1;color:#e2187d;">03</td>
                  <td valign="top" style="padding:20px 0;border-top:1px solid #dedbd3;">
                    <h3 style="margin:0 0 7px;font-size:16px;line-height:1.35;font-weight:800;color:#17171a;">Comunicamos con identidad MALI</h3>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#606068;">Los mensajes pueden salir desde direcciones <strong>@mali.pe</strong>, para que cada comunicación sea claramente reconocible.</p>
                  </td>
                </tr>
                <tr>
                  <td class="benefit-number" width="72" valign="top" style="width:72px;padding:22px 12px 22px 0;border-top:1px solid #dedbd3;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1;color:#e2187d;">04</td>
                  <td valign="top" style="padding:20px 0;border-top:1px solid #dedbd3;">
                    <h3 style="margin:0 0 7px;font-size:16px;line-height:1.35;font-weight:800;color:#17171a;">Sabemos qué funciona</h3>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#606068;">Podemos ver cuántos mensajes llegaron, cuántos fueron abiertos y qué enlaces recibieron más clics.</p>
                  </td>
                </tr>
                <tr>
                  <td class="benefit-number" width="72" valign="top" style="width:72px;padding:22px 12px 22px 0;border-top:1px solid #dedbd3;border-bottom:1px solid #dedbd3;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1;color:#e2187d;">05</td>
                  <td valign="top" style="padding:20px 0;border-top:1px solid #dedbd3;border-bottom:1px solid #dedbd3;">
                    <h3 style="margin:0 0 7px;font-size:16px;line-height:1.35;font-weight:800;color:#17171a;">Todo queda dentro de MALI ONE</h3>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#606068;">El contenido, las listas y los resultados quedan organizados en una herramienta propia, lista para crecer con nuevas necesidades.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#17171a;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td class="metric" width="33.33%" align="center" style="width:33.33%;padding:28px 12px;border-right:1px solid #34343a;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1;color:#a7f3df;">50K</div>
                    <div style="margin-top:8px;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b8b8bf;">personas por día</div>
                  </td>
                  <td class="metric" width="33.33%" align="center" style="width:33.33%;padding:28px 12px;border-right:1px solid #34343a;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1;color:#ff72b6;">14/s</div>
                    <div style="margin-top:8px;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b8b8bf;">envíos por segundo</div>
                  </td>
                  <td class="metric" width="33.33%" align="center" style="width:33.33%;padding:28px 12px;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1;color:#ffffff;">~60%</div>
                    <div style="margin-top:8px;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b8b8bf;">ahorro estimado</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:48px 54px;background:#a7f3df;font-family:Arial,Helvetica,sans-serif;">
              <h2 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;color:#17171a;">Gracias por utilizar MALI ONE.</h2>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#34343a;">Si recibiste este mensaje, nuestra nueva herramienta de comunicaciones ya está funcionando.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background:#17171a;">
                    <a href="https://dev.mali.pe/" style="display:inline-block;padding:14px 22px;font-size:12px;line-height:1;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;color:#ffffff;">Abrir MALI ONE &nbsp;→</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-pad" style="padding:36px 54px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 3px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;color:#17171a;">Atentamente,</p>
              <p style="margin:0;font-size:13px;line-height:1.5;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#e2187d;">Área de TI</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 28px;background:#f7f5f0;border-top:1px solid #e2ded6;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#77777f;">Museo de Arte de Lima — MALI<br>Av. 9 de diciembre 125, Parque de la Exposición · Lima, Perú</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`.trim();

async function main() {
  const existing = await prisma.newsletter.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`El boletín "${existing.title}" ya existe; se conserva su versión editada.`);
    return;
  }

  const ownerEmail = process.env.SEED_NEWSLETTER_OWNER_EMAIL?.trim().toLowerCase();
  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : await prisma.user.findFirst({
        where: { role: UserRole.admin },
        orderBy: { createdAt: 'asc' },
      });

  if (!owner) {
    throw new Error(
      'No hay un usuario administrador para asignar el boletín. Define SEED_NEWSLETTER_OWNER_EMAIL con un usuario existente.',
    );
  }

  const newsletter = await prisma.newsletter.create({
    data: {
      slug: SLUG,
      title: 'Boletín de Prueba TI',
      subject: 'Boletín de prueba: MALI ONE ya está enviando',
      htmlBody,
      designJson: null,
      status: NewsletterStatus.published,
      createdById: owner.id,
    },
  });

  console.log(`Boletín creado: ${newsletter.title} (${newsletter.slug})`);
  console.log('Ya está publicado y puede editarse desde BOLETINES.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
