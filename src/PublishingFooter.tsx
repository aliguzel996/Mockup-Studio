import { ChevronDown, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type PublishingLanguage = 'en' | 'tr' | 'de' | 'ja' | 'es-419' | 'pt-BR' | 'ko' | 'fr';
type OpenSection = 'about' | 'privacy' | null;

const LANGUAGE_KEY = 'rms.publishing-language.v1';

const languageNames: Record<PublishingLanguage, string> = {
  en: 'English', tr: 'Türkçe', de: 'Deutsch', ja: '日本語', 'es-419': 'Español (Latinoamérica)',
  'pt-BR': 'Português (Brasil)', ko: '한국어', fr: 'Français',
};

interface PublishingCopy {
  about: string;
  privacy: string;
  close: string;
  stores: string;
  comingSoon: string;
  aboutTitle: string;
  aboutBody: string;
  aboutList: string[];
  privacyTitle: string;
  effective: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
}

const copies: Record<PublishingLanguage, PublishingCopy> = {
  en: {
    about: 'About', privacy: 'Privacy Policy', close: 'Close', stores: 'Stores', comingSoon: 'Coming soon',
    aboutTitle: 'Responsive Mockup Studio',
    aboutBody: 'A YCSWU creative tool for placing live websites in configurable desktop, laptop, tablet and phone frames, then exporting presentation-ready mockups.',
    aboutList: ['Responsive website preview and custom viewport sizes', 'Editable frame materials, colors, parts, shadows and backgrounds', 'Touch-friendly pan, pinch zoom and tablet layouts', 'PNG, transparent PNG, JPG, WebP and SVG export'],
    privacyTitle: 'Privacy Policy', effective: 'Effective: 23 September 2026',
    sections: [
      { title: 'What the app stores', paragraphs: ['Projects, saved devices, bookmarks, recent URLs, theme, language and interface preferences are stored locally in the browser or app storage. Imported images and generated exports stay on the device unless you choose to share or upload them.'] },
      { title: 'Network activity', paragraphs: ['When you enter a URL, the app connects directly to that website to render its preview. That website and its service providers may receive normal request information such as your IP address, user agent, cookies and requested URL under their own policies. The web edition also downloads the application files from ycswu.co.'] },
      { title: 'Accounts, advertising and analytics', paragraphs: ['Responsive Mockup Studio does not include an account system, advertising SDK, analytics SDK, telemetry service or automatic crash-reporting service. It does not sync projects to a YCSWU account.'] },
      { title: 'Files and device access', paragraphs: ['The app can open image files you select and save exported mockups. Android requests network access for website previews and uses the system file picker and download storage for files you explicitly open or export. It does not request camera, microphone, location or contacts access. Pen input is handled as a pointer and does not require a separate permission.'] },
      { title: 'Page controls and custom CSS', paragraphs: ['Custom CSS and hidden-element selections are applied to the website preview you opened. They are stored locally with your settings. Browser security can limit these controls for websites from another origin.'] },
      { title: 'Clipboard and third parties', paragraphs: ['The current app does not automatically read the clipboard and contains no assistant or MCP connection. Store buttons remain disabled until genuine product listings exist. External websites opened in the preview remain independent third parties.'] },
      { title: 'Deletion and support', paragraphs: ['You can remove saved items in the interface and clear the app or site storage from your operating system or browser. Uninstalling the Android app removes its local app data unless the operating system restores a backup; Android backup is disabled for this release. For privacy questions or deletion requests concerning support correspondence, contact hiycswu@gmail.com. Support emails are processed through the email provider and kept only as needed to handle the request and related obligations.'] },
    ],
  },
  tr: {
    about: 'Uygulama hakkında', privacy: 'Gizlilik Politikası', close: 'Kapat', stores: 'Mağazalar', comingSoon: 'Yakında',
    aboutTitle: 'Responsive Mockup Studio',
    aboutBody: 'Canlı web sitelerini ayarlanabilir masaüstü, laptop, tablet ve telefon çerçevelerine yerleştirip sunuma hazır mockup çıktıları üretmek için geliştirilmiş bir YCSWU creative tool.',
    aboutList: ['Responsive site önizleme ve özel viewport ölçüleri', 'Düzenlenebilir çerçeve materyalleri, renkler, parçalar, gölgeler ve arka planlar', 'Dokunmatik kaydırma, pinch zoom ve tablet düzenleri', 'PNG, şeffaf PNG, JPG, WebP ve SVG dışa aktarma'],
    privacyTitle: 'Gizlilik Politikası', effective: 'Yürürlük: 23 Eylül 2026',
    sections: [
      { title: 'Uygulamanın sakladıkları', paragraphs: ['Projeler, kaydedilen cihazlar, bookmarklar, son URL’ler, tema, dil ve arayüz tercihleri tarayıcıda veya uygulama depolamasında yerel olarak tutulur. İçe aktarılan görseller ve üretilen çıktılar, siz paylaşmayı veya yüklemeyi seçmediğiniz sürece cihazda kalır.'] },
      { title: 'Ağ etkinliği', paragraphs: ['Bir URL girdiğinizde uygulama önizlemeyi göstermek için doğrudan o web sitesine bağlanır. İlgili site ve hizmet sağlayıcıları kendi politikaları kapsamında IP adresi, kullanıcı aracısı, çerezler ve istenen URL gibi normal istek bilgilerini alabilir. Web sürümü ayrıca uygulama dosyalarını ycswu.co üzerinden indirir.'] },
      { title: 'Hesap, reklam ve analiz', paragraphs: ['Responsive Mockup Studio hesap sistemi, reklam SDK’sı, analiz SDK’sı, telemetri servisi veya otomatik hata raporlama servisi içermez. Projeleri bir YCSWU hesabına senkronize etmez.'] },
      { title: 'Dosya ve cihaz erişimi', paragraphs: ['Uygulama sizin seçtiğiniz görsel dosyalarını açabilir ve dışa aktarılan mockup’ları kaydedebilir. Android sürümü site önizlemeleri için ağ erişimi, açıkça seçtiğiniz veya dışa aktardığınız dosyalar için sistem dosya seçicisi ve indirme alanını kullanır. Kamera, mikrofon, konum veya kişiler izni istemez. Kalem girişi pointer olarak işlenir ve ayrı izin gerektirmez.'] },
      { title: 'Sayfa kontrolleri ve özel CSS', paragraphs: ['Özel CSS ve gizlenen eleman seçimleri açtığınız site önizlemesine uygulanır ve ayarlarınızla birlikte yerel tutulur. Tarayıcı güvenliği, farklı origin’deki sitelerde bu kontrolleri sınırlayabilir.'] },
      { title: 'Pano ve üçüncü taraflar', paragraphs: ['Mevcut uygulama panoyu otomatik olarak okumaz ve asistan/MCP bağlantısı içermez. Gerçek mağaza sayfaları oluşana kadar mağaza düğmeleri devre dışıdır. Önizlemede açılan dış siteler bağımsız üçüncü taraflardır.'] },
      { title: 'Silme ve destek', paragraphs: ['Kaydedilen öğeleri arayüzden silebilir, uygulama veya site verisini işletim sistemi ya da tarayıcı ayarlarından temizleyebilirsiniz. Android uygulamasını kaldırmak yerel uygulama verisini siler; bu sürümde Android yedekleme kapalıdır. Gizlilik soruları veya destek yazışmalarının silinmesi için hiycswu@gmail.com adresine yazın. Destek e-postaları e-posta sağlayıcısı üzerinden işlenir ve yalnız talebi ve ilgili yükümlülükleri karşılamak için gerektiği sürece tutulur.'] },
    ],
  },
  de: {
    about: 'Über die App', privacy: 'Datenschutz', close: 'Schließen', stores: 'Stores', comingSoon: 'Demnächst',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: 'Ein YCSWU-Kreativwerkzeug, das Live-Websites in konfigurierbare Desktop-, Laptop-, Tablet- und Telefonrahmen setzt und präsentationsfertige Mockups exportiert.',
    aboutList: ['Responsive Website-Vorschau und eigene Viewports', 'Bearbeitbare Materialien, Farben, Teile, Schatten und Hintergründe', 'Touch-Pan, Pinch-Zoom und Tablet-Layouts', 'Export als PNG, transparentes PNG, JPG, WebP und SVG'],
    privacyTitle: 'Datenschutzerklärung', effective: 'Gültig ab: 23. September 2026',
    sections: [
      { title: 'Lokal gespeicherte Daten', paragraphs: ['Projekte, gespeicherte Geräte, Lesezeichen, letzte URLs, Design-, Sprach- und UI-Einstellungen werden lokal im Browser- oder App-Speicher abgelegt. Importierte Bilder und Exporte bleiben auf dem Gerät, sofern Sie sie nicht selbst teilen oder hochladen.'] },
      { title: 'Netzwerkzugriffe', paragraphs: ['Bei Eingabe einer URL verbindet sich die App direkt mit dieser Website. Die Website kann nach ihren eigenen Richtlinien übliche Anfragedaten wie IP-Adresse, User-Agent, Cookies und URL erhalten. Die Webversion lädt außerdem App-Dateien von ycswu.co.'] },
      { title: 'Konten, Werbung und Analyse', paragraphs: ['Die App enthält kein Kontosystem, keine Werbung, keine Analyse- oder Telemetrie-SDKs und keinen automatischen Absturzbericht. Projekte werden nicht mit einem YCSWU-Konto synchronisiert.'] },
      { title: 'Dateien und Berechtigungen', paragraphs: ['Die App öffnet von Ihnen gewählte Bilder und speichert Exporte. Android verwendet Internetzugriff, System-Dateiauswahl und Download-Speicher, fordert aber keinen Zugriff auf Kamera, Mikrofon, Standort oder Kontakte an. Stifteingaben werden als Zeiger verarbeitet.'] },
      { title: 'CSS und Seitenelemente', paragraphs: ['Benutzerdefiniertes CSS und ausgeblendete Elemente werden lokal gespeichert und auf die geöffnete Vorschau angewendet. Browser-Sicherheitsregeln können dies bei fremden Origins begrenzen.'] },
      { title: 'Zwischenablage und Dritte', paragraphs: ['Die App liest die Zwischenablage nicht automatisch und enthält keine Assistenten- oder MCP-Verbindung. Store-Schaltflächen bleiben bis zu echten Einträgen deaktiviert. Vorschau-Websites sind unabhängige Dritte.'] },
      { title: 'Löschen und Support', paragraphs: ['Gespeicherte Elemente können in der App oder durch Löschen der Browser-/App-Daten entfernt werden. Android-Backup ist deaktiviert. Datenschutzfragen und Löschanfragen zu Support-E-Mails richten Sie an hiycswu@gmail.com; E-Mails werden nur so lange verarbeitet, wie es für die Anfrage und einschlägige Pflichten erforderlich ist.'] },
    ],
  },
  ja: {
    about: 'アプリについて', privacy: 'プライバシーポリシー', close: '閉じる', stores: 'ストア', comingSoon: '近日公開',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: 'ライブWebサイトをデスクトップ、ノートPC、タブレット、スマートフォンのフレームに配置し、プレゼン用モックアップを書き出すYCSWUクリエイティブツールです。',
    aboutList: ['レスポンシブプレビューとカスタムviewport', '素材、色、パーツ、影、背景の編集', 'タッチパン、ピンチズーム、タブレットレイアウト', 'PNG、透過PNG、JPG、WebP、SVG書き出し'],
    privacyTitle: 'プライバシーポリシー', effective: '施行日: 2026年9月23日',
    sections: [
      { title: '端末内に保存する情報', paragraphs: ['プロジェクト、保存済み端末、ブックマーク、最近のURL、テーマ、言語、UI設定はブラウザまたはアプリ内に保存されます。読み込んだ画像と書き出しファイルは、ご自身で共有・アップロードしない限り端末内に残ります。'] },
      { title: 'ネットワーク通信', paragraphs: ['URLを入力すると、そのWebサイトへ直接接続してプレビューします。相手サイトは独自の方針に従い、IPアドレス、ユーザーエージェント、Cookie、URLなど通常のリクエスト情報を受け取る場合があります。Web版はycswu.coからアプリファイルも取得します。'] },
      { title: 'アカウント・広告・分析', paragraphs: ['アカウント、広告SDK、分析SDK、テレメトリ、自動クラッシュ報告は含まれず、プロジェクトをYCSWUアカウントへ同期しません。'] },
      { title: 'ファイルと権限', paragraphs: ['選択した画像を開き、書き出しを保存できます。Android版はインターネット、システムのファイル選択、ダウンロード保存を使用しますが、カメラ、マイク、位置情報、連絡先の権限は要求しません。ペンはポインターとして処理されます。'] },
      { title: 'CSSとページ要素', paragraphs: ['カスタムCSSと非表示要素の選択は端末内に保存され、開いたプレビューに適用されます。異なるオリジンではブラウザのセキュリティにより制限される場合があります。'] },
      { title: 'クリップボードと第三者', paragraphs: ['クリップボードを自動読取せず、アシスタント/MCP接続もありません。実在するストア掲載ができるまでストアボタンは無効です。プレビュー先は独立した第三者です。'] },
      { title: '削除とサポート', paragraphs: ['アプリ内で保存項目を削除し、OSまたはブラウザからデータを消去できます。Androidバックアップは無効です。サポートメールのプライバシー・削除依頼はhiycswu@gmail.comへご連絡ください。メールは依頼対応と関連義務に必要な期間のみ処理されます。'] },
    ],
  },
  'es-419': {
    about: 'Acerca de la app', privacy: 'Política de privacidad', close: 'Cerrar', stores: 'Tiendas', comingSoon: 'Próximamente',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: 'Una herramienta creativa de YCSWU para colocar sitios web en marcos configurables y exportar mockups listos para presentar.',
    aboutList: ['Vista responsive y viewports personalizados', 'Materiales, colores, piezas, sombras y fondos editables', 'Desplazamiento táctil, zoom con dos dedos y diseños para tablet', 'Exportación PNG, PNG transparente, JPG, WebP y SVG'],
    privacyTitle: 'Política de privacidad', effective: 'Vigente desde: 23 de septiembre de 2026',
    sections: [
      { title: 'Datos guardados localmente', paragraphs: ['Los proyectos, dispositivos guardados, favoritos, URL recientes y preferencias se almacenan localmente. Las imágenes importadas y exportaciones permanecen en el dispositivo salvo que decidas compartirlas o subirlas.'] },
      { title: 'Actividad de red', paragraphs: ['Al ingresar una URL, la app se conecta directamente a ese sitio. El sitio puede recibir IP, agente de usuario, cookies y URL según sus propias políticas. La versión web también descarga archivos de ycswu.co.'] },
      { title: 'Cuentas, anuncios y analítica', paragraphs: ['La app no incluye cuentas, anuncios, analítica, telemetría ni reportes automáticos de fallos, y no sincroniza proyectos con una cuenta YCSWU.'] },
      { title: 'Archivos y permisos', paragraphs: ['La app abre imágenes elegidas y guarda exportaciones. Android usa Internet, el selector de archivos y el almacenamiento de descargas; no solicita cámara, micrófono, ubicación ni contactos. El lápiz se procesa como puntero.'] },
      { title: 'CSS y elementos de página', paragraphs: ['El CSS personalizado y los elementos ocultos se guardan localmente y se aplican a la vista abierta. La seguridad del navegador puede limitarlo en otros orígenes.'] },
      { title: 'Portapapeles y terceros', paragraphs: ['La app no lee automáticamente el portapapeles ni incluye conexión de asistente/MCP. Los botones de tienda permanecen desactivados hasta tener fichas reales. Los sitios de vista previa son terceros independientes.'] },
      { title: 'Eliminación y soporte', paragraphs: ['Puedes borrar elementos o limpiar los datos de la app/sitio. El respaldo de Android está desactivado. Para privacidad o eliminación de correos de soporte escribe a hiycswu@gmail.com; se conservan solo mientras sean necesarios para atender la solicitud y obligaciones relacionadas.'] },
    ],
  },
  'pt-BR': {
    about: 'Sobre o app', privacy: 'Política de Privacidade', close: 'Fechar', stores: 'Lojas', comingSoon: 'Em breve',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: 'Uma ferramenta criativa YCSWU para inserir sites em molduras configuráveis e exportar mockups prontos para apresentação.',
    aboutList: ['Prévia responsiva e viewports personalizados', 'Materiais, cores, peças, sombras e fundos editáveis', 'Pan por toque, zoom com pinça e layouts para tablet', 'Exportação PNG, PNG transparente, JPG, WebP e SVG'],
    privacyTitle: 'Política de Privacidade', effective: 'Vigência: 23 de setembro de 2026',
    sections: [
      { title: 'Dados armazenados localmente', paragraphs: ['Projetos, dispositivos salvos, favoritos, URLs recentes e preferências ficam no armazenamento local. Imagens importadas e exportações permanecem no dispositivo, salvo se você decidir compartilhar ou enviar.'] },
      { title: 'Atividade de rede', paragraphs: ['Ao inserir uma URL, o app conecta diretamente ao site. Ele pode receber IP, agente do usuário, cookies e URL conforme sua própria política. A versão web também baixa arquivos de ycswu.co.'] },
      { title: 'Contas, publicidade e análise', paragraphs: ['O app não inclui contas, publicidade, SDK de análise, telemetria ou relatório automático de falhas, nem sincroniza projetos com conta YCSWU.'] },
      { title: 'Arquivos e permissões', paragraphs: ['O app abre imagens selecionadas e salva exportações. No Android usa Internet, seletor de arquivos e armazenamento de downloads; não solicita câmera, microfone, localização ou contatos. A caneta é tratada como ponteiro.'] },
      { title: 'CSS e elementos da página', paragraphs: ['CSS personalizado e elementos ocultos ficam armazenados localmente e são aplicados à prévia aberta. A segurança do navegador pode limitar isso em outras origens.'] },
      { title: 'Área de transferência e terceiros', paragraphs: ['O app não lê automaticamente a área de transferência nem possui conexão assistente/MCP. Botões das lojas ficam desativados até existirem páginas reais. Sites na prévia são terceiros independentes.'] },
      { title: 'Exclusão e suporte', paragraphs: ['Você pode excluir itens ou limpar os dados do app/site. O backup Android está desativado. Para privacidade ou exclusão de e-mails de suporte, contate hiycswu@gmail.com; mensagens são mantidas apenas enquanto necessário para atender à solicitação e obrigações relacionadas.'] },
    ],
  },
  ko: {
    about: '앱 정보', privacy: '개인정보 처리방침', close: '닫기', stores: '스토어', comingSoon: '출시 예정',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: '실제 웹사이트를 설정 가능한 데스크톱, 노트북, 태블릿, 휴대폰 프레임에 배치하고 프레젠테이션용 목업으로 내보내는 YCSWU 크리에이티브 도구입니다.',
    aboutList: ['반응형 미리보기와 사용자 viewport', '편집 가능한 재질, 색상, 부품, 그림자, 배경', '터치 이동, 핀치 줌, 태블릿 레이아웃', 'PNG, 투명 PNG, JPG, WebP, SVG 내보내기'],
    privacyTitle: '개인정보 처리방침', effective: '시행일: 2026년 9월 23일',
    sections: [
      { title: '로컬 저장 정보', paragraphs: ['프로젝트, 저장된 장치, 북마크, 최근 URL, 테마, 언어 및 UI 설정은 브라우저나 앱 저장소에 로컬로 저장됩니다. 가져온 이미지와 내보낸 파일은 사용자가 공유하거나 업로드하지 않는 한 장치에 남습니다.'] },
      { title: '네트워크 활동', paragraphs: ['URL을 입력하면 미리보기를 위해 해당 사이트에 직접 연결합니다. 사이트는 자체 정책에 따라 IP 주소, 사용자 에이전트, 쿠키, URL 등 일반 요청 정보를 받을 수 있습니다. 웹 버전은 ycswu.co에서 앱 파일도 다운로드합니다.'] },
      { title: '계정, 광고 및 분석', paragraphs: ['계정 시스템, 광고, 분석 SDK, 원격 측정, 자동 오류 보고가 없으며 프로젝트를 YCSWU 계정과 동기화하지 않습니다.'] },
      { title: '파일 및 권한', paragraphs: ['선택한 이미지를 열고 내보내기를 저장합니다. Android는 인터넷, 시스템 파일 선택기와 다운로드 저장소를 사용하지만 카메라, 마이크, 위치 또는 연락처 권한은 요청하지 않습니다. 펜은 포인터로 처리됩니다.'] },
      { title: 'CSS와 페이지 요소', paragraphs: ['사용자 CSS와 숨김 요소 선택은 로컬 저장되며 열린 미리보기에 적용됩니다. 다른 origin에서는 브라우저 보안에 의해 제한될 수 있습니다.'] },
      { title: '클립보드 및 제3자', paragraphs: ['클립보드를 자동으로 읽지 않으며 어시스턴트/MCP 연결이 없습니다. 실제 스토어 등록 전까지 스토어 버튼은 비활성화됩니다. 미리보기 사이트는 독립적인 제3자입니다.'] },
      { title: '삭제 및 지원', paragraphs: ['앱에서 항목을 삭제하거나 OS/브라우저에서 데이터를 지울 수 있습니다. Android 백업은 비활성화되어 있습니다. 지원 메일의 개인정보 또는 삭제 요청은 hiycswu@gmail.com으로 연락하세요. 메일은 요청 처리 및 관련 의무에 필요한 동안만 보관됩니다.'] },
    ],
  },
  fr: {
    about: 'À propos', privacy: 'Politique de confidentialité', close: 'Fermer', stores: 'Stores', comingSoon: 'Bientôt',
    aboutTitle: 'Responsive Mockup Studio', aboutBody: 'Un outil créatif YCSWU pour placer des sites web dans des cadres configurables et exporter des mockups prêts à présenter.',
    aboutList: ['Aperçu responsive et viewports personnalisés', 'Matériaux, couleurs, pièces, ombres et arrière-plans modifiables', 'Déplacement tactile, zoom par pincement et mises en page tablette', 'Export PNG, PNG transparent, JPG, WebP et SVG'],
    privacyTitle: 'Politique de confidentialité', effective: 'En vigueur : 23 septembre 2026',
    sections: [
      { title: 'Données stockées localement', paragraphs: ['Les projets, appareils enregistrés, favoris, URL récentes et préférences sont stockés localement. Les images importées et exports restent sur l’appareil sauf si vous les partagez ou les envoyez.'] },
      { title: 'Activité réseau', paragraphs: ['Lorsque vous saisissez une URL, l’application se connecte directement au site. Celui-ci peut recevoir l’adresse IP, l’agent utilisateur, les cookies et l’URL selon sa propre politique. La version web télécharge aussi ses fichiers depuis ycswu.co.'] },
      { title: 'Comptes, publicité et analyse', paragraphs: ['L’application ne contient ni compte, ni publicité, ni SDK d’analyse, ni télémétrie, ni rapport automatique de plantage et ne synchronise pas les projets avec un compte YCSWU.'] },
      { title: 'Fichiers et autorisations', paragraphs: ['L’application ouvre les images choisies et enregistre les exports. Android utilise Internet, le sélecteur de fichiers et le stockage des téléchargements, sans demander l’accès à la caméra, au microphone, à la localisation ou aux contacts. Le stylet est traité comme un pointeur.'] },
      { title: 'CSS et éléments de page', paragraphs: ['Le CSS personnalisé et les éléments masqués sont conservés localement et appliqués à l’aperçu. La sécurité du navigateur peut limiter ces fonctions sur une autre origine.'] },
      { title: 'Presse-papiers et tiers', paragraphs: ['L’application ne lit pas automatiquement le presse-papiers et ne contient aucune connexion assistant/MCP. Les boutons des stores restent désactivés jusqu’à l’existence de fiches réelles. Les sites prévisualisés sont des tiers indépendants.'] },
      { title: 'Suppression et assistance', paragraphs: ['Vous pouvez supprimer les éléments ou effacer les données du site/de l’application. La sauvegarde Android est désactivée. Pour toute question ou suppression d’e-mails d’assistance, contactez hiycswu@gmail.com ; les messages ne sont conservés que le temps nécessaire au traitement et aux obligations associées.'] },
    ],
  },
};

const isPublishingLanguage = (value: string | null): value is PublishingLanguage => Boolean(value && value in copies);

export default function PublishingFooter() {
  const initialLanguage = useMemo<PublishingLanguage>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (isPublishingLanguage(stored)) return stored;
    const browser = navigator.language;
    if (browser.startsWith('tr')) return 'tr';
    if (browser.startsWith('de')) return 'de';
    if (browser.startsWith('ja')) return 'ja';
    if (browser.startsWith('es')) return 'es-419';
    if (browser.startsWith('pt')) return 'pt-BR';
    if (browser.startsWith('ko')) return 'ko';
    if (browser.startsWith('fr')) return 'fr';
    return 'en';
  }, []);
  const [language, setLanguage] = useState<PublishingLanguage>(initialLanguage);
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const copy = copies[language];

  useEffect(() => localStorage.setItem(LANGUAGE_KEY, language), [language]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#privacy-policy' || hash === '#privacy-policy.html') {
        setOpenSection('privacy');
        window.requestAnimationFrame(() => document.getElementById('privacy-policy')?.scrollIntoView({ block: 'nearest' }));
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!openSection) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenSection(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [openSection]);

  const toggle = (section: Exclude<OpenSection, null>) => setOpenSection((current) => current === section ? null : section);

  return (
    <footer className={`publishing-footer ${openSection ? 'open' : ''}`}>
      {openSection && (
        <section className="publishing-drawer" id={openSection === 'privacy' ? 'privacy-policy' : 'app-about'} aria-live="polite">
          <div className="publishing-drawer-heading">
            <div><ShieldCheck size={16} /><span>{openSection === 'privacy' ? copy.privacyTitle : copy.aboutTitle}</span></div>
            <button type="button" onClick={() => setOpenSection(null)} aria-label={copy.close} title={copy.close}><X size={16} /></button>
          </div>
          <div className="publishing-drawer-scroll">
            {openSection === 'about' ? (
              <div className="publishing-about-copy"><p>{copy.aboutBody}</p><ul>{copy.aboutList.map((item) => <li key={item}>{item}</li>)}</ul></div>
            ) : (
              <article className="publishing-privacy-copy"><p className="privacy-effective">{copy.effective}</p>{copy.sections.map((section) => <section key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article>
            )}
          </div>
        </section>
      )}
      <div className="publishing-bar">
        <div className="publishing-links">
          <button type="button" className={openSection === 'about' ? 'active' : ''} aria-expanded={openSection === 'about'} onClick={() => toggle('about')}>{copy.about}<ChevronDown size={12} /></button>
          <button type="button" className={openSection === 'privacy' ? 'active' : ''} aria-expanded={openSection === 'privacy'} onClick={() => toggle('privacy')}>{copy.privacy}<ChevronDown size={12} /></button>
        </div>
        <label className="publishing-language"><span>INFO</span><select aria-label="Information language" value={language} onChange={(event) => setLanguage(event.target.value as PublishingLanguage)}>{(Object.keys(languageNames) as PublishingLanguage[]).map((code) => <option value={code} key={code}>{languageNames[code]}</option>)}</select></label>
        <div className="publishing-stores" aria-label={copy.stores}>
          <button type="button" disabled title={copy.comingSoon}><span>Google Play</span><small>{copy.comingSoon}</small><ExternalLink size={11} /></button>
          <button type="button" disabled title={copy.comingSoon}><span>Microsoft Store</span><small>{copy.comingSoon}</small><ExternalLink size={11} /></button>
        </div>
      </div>
    </footer>
  );
}
