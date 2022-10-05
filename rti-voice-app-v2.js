'use strict'

//-------------

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const expressWs = require('express-ws')(app);
const Vonage = require('@vonage/server-sdk');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');

// ------------------

const notWebsocket = "not_websocket";

//------------------

// HTTP client
const request = require('request');

const reqHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

//------ phone number matching -- compare last digits -------

const lastDigits = 9;

//------ for trade shows and external parties self started demos ------

const maxCallDuration = 180000; // 3 min
const maxCallsPerDay = 6;
const ttsCustom1Duration = 15000; // 15 sec, approximate TTS duration + margin

// add here phone numbers that will not be limited
const whiteListedNumbers = ['12995550101', '33101020304', '44200101010101'];

const limitCalls = (process.env.LIMITCALLS === "true") || false;  // set to true for self-serve demos 


//---- CORS policy - Update this section as needed ----

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
  next();
});

//-------

app.use(bodyParser.json());

//-------

let router = express.Router();
router.get('/', express.static('app'));
app.use('/app',router);

//------

const servicePhoneNumber = process.env.SERVICE_PHONE_NUMBER;

//-------------

const vonage = new Vonage({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'
});

//------------

// Server hosting the connecting code for STT and Translation
const processorServer = process.env.PROCESSOR_SERVER;

//-------------

let langSetting = {};

function addToLangSetting (info) {
  langSetting[info[0]] = {};  // dictionary
  langSetting[info[0]]["commonName"] = info[1];  // e.g. "English (United States)"
  langSetting[info[0]]["vapiTtsStyle0"] = info[2];  // preferred VAPI TTS style
  langSetting[info[0]]["vapiTtsStyle1"] = info[3];  
  langSetting[info[0]]["vapiTtsStyle2"] = info[4];
  langSetting[info[0]]["vapiTtsStyle3"] = info[5]; 
  langSetting[info[0]]["standardGreeting"] = info[6];  
  langSetting[info[0]]["shortGreeting"] = info[7]; 
  langSetting[info[0]]["speakNow"] = info[8]; 
  langSetting[info[0]]["enterNumber"] = info[9];
  langSetting[info[0]]["wait"] = info[10]; 
  langSetting[info[0]]["selectLang"] = info[11];
  langSetting[info[0]]["custom1"] = info[12];
  langSetting[info[0]]["custom2"] = info[13];
}

const ar = [
  "ar",
  "عربي (Arabic)",
  "4", // preferred VAPI TTS style, male
  "2", // female
  "5", // male
  "1", // or "7", female
  "مرحبًا ، الشخص الآخر في هذه المكالمة يتحدث لغة أخرى ، وسوف تسمع صوت الشخص الآخر وترجمة حديثه. هذه الميزة ممكنة باستخدام خدمات اتصالات Vonage القابلة للبرمجة. شكرا لك!",
  "أهلا", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (ar);

const euES = [
  "eu-ES",
  "Euskara (Basque)",
  "0", // female
  "",
  "",
  "",
  "Kaixo, dei honetako beste pertsona beste hizkuntza bat ari da hizketan, bestearen ahotsa eta bere hizkeraren itzulpena entzungo dituzu. Funtzio hau posible da Vonage programagarriak diren komunikazio zerbitzuak erabiliz. Eskerrik asko!", // standard greeting
  "Kaixo", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (euES);

const bnIN = [
  "bn-IN",
  "বাংলা (Bengali)",
  "1", // preferred VAPI TTS style, male
  "0", // female
  "",
  "",
  "হ্যালো, এই কলটিতে অন্য ব্যক্তি অন্য ভাষায় কথা বলছে, আপনি অন্য ব্যক্তির কণ্ঠস্বর শুনতে পাবেন, এবং তাদের বক্তব্যের অনুবাদ। এই বৈশিষ্ট্য Vonage প্রোগ্রামযোগ্য যোগাযোগ পরিষেবা ব্যবহার করে সম্ভব। ধন্যবাদ!", // standard greeting
  "হ্যালো", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (bnIN);

const caES = [
  "ca-ES",
  "Català - Valencià (Catalan)",
  "1", // preferred VAPI TTS style, male
  "0", // female
  "",
  "",
  "Hola, l'altra persona en aquesta trucada parla un altre idioma, sentireu la veu de l'altra persona i la traducció del seu discurs. Aquesta característica és possible mitjançant l'ús de serveis de comunicacions programables de Vonage. Gràcies!", // standard greeting
  "Hola", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (caES);

const yueCN = [
  "yue-CN",
  "广东话 (Chinese - Cantonese)",
  "0", // female
  "",
  "",
  "",
  "您好，此通话中的对方说另一种语言，您将听到对方的声音和他们讲话的翻译。使用 Vonage 的可编程通信服务可以实现此功能。谢谢",
  "您好",  // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (yueCN);

const cmnCN = [
  "cmn-CN",
  "普通话 (Chinese - Mandarin)",
  "1", // preferred VAPI TTS style - female
  "4", // male
  "2", // female
  "3", // female
  "您好，此通话中的对方说另一种语言，您将听到对方的声音和他们讲话的翻译。使用 Vonage 的可编程通信服务可以实现此功能。谢谢",
  "您好",  // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (cmnCN);

const cmnTW = [
  "cmn-TW",
  "台湾普通话 (Chinese - Mandarin - Taiwan)",
  "0", // preferred VAPI TTS style - female
  "3", // male
  "1", // female
  "2", // male
  "您好，此通话中的对方说另一种语言，您将听到对方的声音和他们讲话的翻译。使用 Vonage 的可编程通信服务可以实现此功能。谢谢",
  "您好",  // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (cmnTW);

const csCZ = [
  "cs-CZ",
  "Čeština (Czech)",
  "0", // preferred VAPI TTS style - female
  "2", // female
  "1", // female
  "",
  "Dobrý den, druhá osoba v tomto hovoru mluví jiným jazykem, uslyšíte hlas druhé osoby a překlad její řeči. Tato funkce je možná pomocí programovatelných komunikačních služeb Vonage. Děkuji!", // standard greeting
  "Ahoj", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (csCZ);

const daDK = [
  "da-DK",
  "Dansk (Danish)",
  "1", // preferred VAPI TTS style - female
  "5", // male
  "4", // female
  "2", // male
  "Hej, den anden person på dette opkald taler et andet sprog, du vil høre den andens stemme og oversættelsen af deres tale. Denne funktion er mulig ved at bruge Vonage programmerbare kommunikationstjenester. Tak skal du have!", // standard greeting
  "Hej", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (daDK);

const nlNL = [
  "nl-NL",
  "Nederlands (Dutch)",
  "1", // preferred VAPI TTS style - female
  "5", // male
  "2", // or "3" is another alternative, female
  "6", // male
  "Hallo, de andere persoon in dit gesprek spreekt een andere taal, u hoort de stem van de andere persoon en de vertaling van hun spraak. Deze functie is mogelijk door gebruik te maken van programmeerbare communicatiediensten van Vonage. Bedankt!", // standard greeting
  "Hallo", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (nlNL);

const enAU = [
  "en-AU",
  "English - Australia",
  "4", // preferred VAPI TTS style, male
  "1", // female
  "5", // male
  "2", // female
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enAU);

const enIN = [
  "en-IN",
  "English - India",
  "4", // preferred VAPI TTS style, male  TBD <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  "2", // female
  "3", // male
  "5", // female
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enIN);

const enZA = [
  "en-ZA",
  "English - South Africa",
  "0", // female
  "",
  "",
  "",
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enZA);

const enGB = [
  "en-GB",
  "English - United Kingdom",
  "7", // preferred VAPI TTS style, female
  "5", // male
  "3", // female
  "6", // male
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enGB);

const enUS = [
  "en-US",
  "English - United States",
  "11", // preferred VAPI TTS style   TBD <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  "6", // female
  "10", // male
  "5", // female
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "You have reached the maximum allowed duration for this call. This call is now going to be terminated. Thank you for previewing this new Vonage Communications Platfom feature. Good bye!", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enUS);

const enGBWLS = [
  "en-GB-WLS",
  "English - Wales",
  "0", // male
  "",
  "",
  "",
  "Hello, the other person on this call is speaking another language, you will hear the other person's voice, and the translation of their speech.  This feature is possible by using Vonage programmable communications services. Thank you!",
  "Hello", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (enGBWLS);

const filPH = [
  "fil-PH",
  "Filipino",
  "2", // preferred VAPI TTS style, male
  "0", // female
  "1", // female
  "3", // male
  "Kumusta, ang ibang tao sa tawag na ito ay nagsasalita ng ibang wika, maririnig mo ang tinig ng ibang tao, at ang pagsasalin ng kanilang pagsasalita. Ang tampok na ito ay posible sa pamamagitan ng paggamit ng Vonage programmable na mga serbisyo sa komunikasyon. Salamat!", // standard greeting
  "Kumusta", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (filPH);

const fiFI = [
  "fi-FI",
  "Suomalainen (Finnish)",
  "0", // preferred VAPI TTS style, female
  "1", // female
  "", 
  "", 
  "Hei, toinen tämän puhelun henkilö puhuu toista kieltä, kuulet toisen henkilön äänen ja hänen puheensa käännöksen. Tämä ominaisuus on mahdollista käyttämällä Vonage -ohjelmoitavia viestintäpalveluja. Kiitos!", // standard greeting
  "Hei", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (fiFI);

const frCA = [
  "fr-CA",
  "Français - Canada (French)",
  "3", // preferred VAPI TTS style, male
  "2", // female
  "1", // female
  "4", // male
  "Bonjour, l'autre personne sur cet appel parle une autre langue, vous entendrez la voix de l'autre personne et la traduction de leur discours. Cette fonctionnalité est possible en utilisant les services de communications programmables de Vonage. Merci!",
  "Bonjour", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (frCA);

const frFR = [
  "fr-FR",
  "Français - France (French)",
  "6", // preferred VAPI TTS style TBD <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  "2", // female
  "4", // female
  "7", // male
  "Bonjour, l'autre personne sur cet appel parle une autre langue, vous entendrez la voix de l'autre personne et la traduction de leur discours. Cette fonctionnalité est possible en utilisant les services de communications programmables de Vonage. Merci!",
  "Bonjour", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (frFR);

const deDE = [
  "de-DE",
  "Deutsch (German)",
  "4", // preferred VAPI TTS style style TBD <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  "5", // female
  "6", // male
  "2", // female
  "Hallo, die andere Person in diesem Anruf spricht eine andere Sprache, Sie hören die Stimme der anderen Person und die Übersetzung ihrer Sprache. Diese Funktionalität ist mit den programmierbaren Kommunikationsdiensten von Vonage möglich. Vielen Dank!",
  "Hallo", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (deDE);

const elGR = [
  "el-GR",
  "Ελληνικά (Greek)",
  "0", // preferred VAPI TTS style, female
  "2", // male
  "1", // female
  "", 
  "Γεια σας, το άλλο άτομο σε αυτήν την κλήση μιλά άλλη γλώσσα, θα ακούσετε τη φωνή του άλλου και τη μετάφραση της ομιλίας του. Αυτή η δυνατότητα είναι δυνατή με τη χρήση προγραμματιζόμενων υπηρεσιών επικοινωνίας Vonage. Σας ευχαριστώ!", // standard greeting
  "γεια σας", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (elGR);

const heIL = [
  "he-IL",
  "עִברִית (Hebrew)",
  "0", // female
  "",
  "",
  "",
  "שלום, האדם האחר בשיחה זו דובר שפה אחרת, אתה תשמע את הקול של האדם האחר ואת התרגום של הדיבור שלו. פונקציונליות זו אפשרית באמצעות שירותי התקשורת הניתנים לתכנות של Vonage. תודה!",
  "שלום", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (heIL);

const hiIN = [
  "hi-IN",
  "हिंदी (Hindi)",
  "2", // preferred VAPI TTS style, female
  "4", // male
  "5", // female 
  "3", // male 
  "नमस्ते, इस कॉल पर दूसरा व्यक्ति दूसरी भाषा बोल रहा है, आप दूसरे व्यक्ति की आवाज़ और उनके भाषण का अनुवाद सुनेंगे। Vonage प्रोग्रामयोग्य संचार सेवाओं का उपयोग करके यह सुविधा संभव है। शुक्रिया!", // standard greeting
  "नमस्ते", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (hiIN);

const huHU = [
  "hu-HU",
  "Magyar (Hungarian)",
  "1", // preferred VAPI TTS style, female
  "0", // female
  "", 
  "", 
  "Helló! A hívásban résztvevő másik személy egy másik nyelvet beszél, hallja a másik személy hangját és beszédének fordítását. Ez a funkció a Vonage programozható kommunikációs szolgáltatások használatával lehetséges. Köszönöm!", // standard greeting
  "Helló!", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (huHU);

const isIS = [
  "is-IS",
  "Íslensku (Icelandic)",
  "1", // preferred VAPI TTS style, male
  "0", // female
  "", 
  "", 
  "Halló, hinn í þessu símtali er að tala annað tungumál, þú munt heyra rödd hins aðilans og þýðingu á ræðu hans. Þessi eiginleiki er mögulegur með því að nota Vonage forritanlega fjarskiptaþjónustu. Þakka þér fyrir!", // standard greeting
  "Halló", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (isIS);

const idID = [
  "id-ID",
  "Bahasa Indonesia (Indonesian)",
  "1", // preferred VAPI TTS style, female
  "3", // male
  "4", // female
  "2", // male
  "Halo, orang lain dalam panggilan ini berbicara bahasa lain, Anda akan mendengar suara orang lain, dan terjemahan pidato mereka. Fitur ini dimungkinkan dengan menggunakan layanan komunikasi yang dapat diprogram Vonage. Terima kasih!", // standard greeting
  "Halo", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (idID);

const itIT = [
  "it-IT",
  "Italiano (Italian)",
  "5", // preferred VAPI TTS style, male
  "2", // female
  "6", // male
  "3", // female
  "Ciao, l'altra persona in questa chiamata parla un'altra lingua, sentirai la voce dell'altra persona e la traduzione del suo discorso. Questa funzionalità è possibile utilizzando i servizi di comunicazione programmabili di Vonage. Grazie!",
  "Ciao", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (itIT);

const jaJP = [
  "ja-JP",
  "日本 (Japanese)",
  "4", // preferred VAPI TTS style, female
  "1", // female
  "5", // male
  "2", // female
  "こんにちは、この通話の他の人は別の言語を話します。あなたは他の人の声と彼らのスピーチの翻訳を聞くでしょう。この機能は、Vonageのプログラム可能な通信サービスを使用して可能です。ありがとうございました！",
  "こんにちは", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (jaJP);

const koKR = [
  "ko-KR",
  "한국인 (Korean)",
  "1", // preferred VAPI TTS style, female
  "4", // male
  "3", // female
  "5", // male
  "안녕하세요, 이 통화의 상대방은 다른 언어를 사용하고 있습니다. 상대방의 음성과 음성 번역을 들을 수 있습니다. 이 기능은 Vonage 프로그래밍 가능한 통신 서비스를 사용하여 가능합니다. 감사합니다!", // standard greeting
  "안녕하십니까", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (koKR);

const mlIN = [
  "ml-IN",
  "മലയാളം (Malayalam)",
  "0", // preferred VAPI TTS style, female
  "1", // male
  "",
  "",
  "ഹലോ, ഈ കോളിലെ മറ്റൊരാൾ മറ്റൊരു ഭാഷ സംസാരിക്കുന്നു, മറ്റൊരാളുടെ ശബ്ദവും അവരുടെ സംസാരത്തിന്റെ വിവർത്തനവും നിങ്ങൾ കേൾക്കും. വോണേജ് പ്രോഗ്രാമബിൾ കമ്മ്യൂണിക്കേഷൻ സേവനങ്ങൾ ഉപയോഗിച്ച് ഈ സവിശേഷത സാധ്യമാണ്. നന്ദി!", // standard greeting
  "ഹലോ", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (mlIN);

const nbNO = [
  "nb-NO",
  "Norsk (Norwegian)",
  "6", // preferred VAPI TTS style, female
  "5", // male
  "3", // female
  "7", // male
  "Hei, den andre personen i denne samtalen snakker et annet språk, du vil høre den andre personens stemme og oversettelsen av talen. Denne funksjonen er mulig ved å bruke Vonage programmerbare kommunikasjonstjenester. Takk skal du ha!", // standard greeting
  "Hallo", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (nbNO);

const plPL = [
  "pl-PL",
  "Polskie (Polish)",
  "7", // preferred VAPI TTS style, male
  "4", // female
  "8", // male
  "2", // female
  "Witaj, druga osoba rozmawiająca mówi w innym języku, usłyszysz głos drugiej osoby i tłumaczenie jej mowy. Ta funkcja jest możliwa dzięki programowalnym usługom komunikacyjnym Vonage. Dziękuję Ci!", // standard greeting
  "Dzień dobry", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (plPL);

const ptBR = [
  "pt-BR",
  "Português - Brasil (Portuguese)",
  "1", // preferred VAPI TTS style, female
  "4", // male
  "2", // female
  "3", // male
  "Olá, a outra pessoa nesta chamada está falando outro idioma. Você ouvirá a voz da outra pessoa e a tradução de sua fala. Este recurso é possível usando os serviços de comunicação programáveis Vonage. Obrigado!", // standard greeting
  "Olá", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (ptBR);

const ptPT = [
  "pt-PT",
  "Português - Portugal (Portuguese)",
  "4", // preferred VAPI TTS style, female
  "7", // male
  "1", // female
  "6", // male
  "Olá, a outra pessoa nesta chamada está falando outro idioma. Você ouvirá a voz da outra pessoa e a tradução de sua fala. Este recurso é possível usando os serviços de comunicação programáveis Vonage. Obrigado!", // standard greeting
  "Olá", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (ptPT);

const roRO = [
  "ro-RO",
  "Română (Romanian)",
  "1", // preferred VAPI TTS style, female
  "0", // female
  "", 
  "", 
  "Bună ziua, cealaltă persoană din acest apel vorbește o altă limbă, veți auzi vocea celeilalte persoane și traducerea discursului său. Această caracteristică este posibilă prin utilizarea serviciilor de comunicații programabile Vonage. Mulțumesc!", // standard greeting
  "Bună ziua", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (roRO);

const ruRU = [
  "ru-RU",
  "Pусский (Russian)",
  "6", // preferred VAPI TTS style, male
  "3", // female
  "5", // male
  "1", // or "2", female
  "Здравствуйте, собеседник по этому вызову говорит на другом языке, вы услышите его голос и перевод его речи. Эта функциональность возможна с использованием программируемых коммуникационных сервисов Vonage. Спасибо!",
  "Здравствуйте", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (ruRU);

const skSK= [
  "sk-SK",
  "Slovenský (Slovak)",
  "1", // preferred VAPI TTS style, female
  "0", // female
  "", 
  "", 
  "Dobrý deň, druhá osoba v tomto hovore hovorí iným jazykom, budete počuť hlas druhej osoby a preklad jej reči. Táto funkcia je možná pomocou programovateľných komunikačných služieb Vonage. Ďakujem!", // standard greeting
  "Ahoj", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (skSK);

const esMX = [
  "es-MX",
  "Español - México (Spanish)",
  "0", // female
  "",
  "",
  "",
  "Hola, la otra persona en esta llamada habla otro idioma, escucharás la voz de la otra persona y la traducción de su discurso. Esta funcionalidad es posible mediante los servicios de comunicaciones programables de Vonage. ¡Gracias!",
  "Hola", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (esMX);

const esES = [
  "es-ES",
  "Español - España (Spanish)",
  "2", // preferred VAPI TTS style, female
  "3", // female
  "0", // female
  "1", // female
  "Hola, la otra persona en esta llamada habla otro idioma, escucharás la voz de la otra persona y la traducción de su discurso. Esta funcionalidad es posible mediante los servicios de comunicaciones programables de Vonage. ¡Gracias!",
  "Hola", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (esES);

const esUS = [
  "es-US",
  "Español - Estados Unidos (Spanish)",
  "1", // preferred VAPI TTS style, male
  "2", // female
  "0", // female
  "",
  "Hola, la otra persona en esta llamada habla otro idioma, escucharás la voz de la otra persona y la traducción de su discurso. Esta funcionalidad es posible mediante los servicios de comunicaciones programables de Vonage. ¡Gracias!",
  "Hola", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (esUS);

const svSE= [
  "sv-SE",
  "Svenska (Swedish)",
  "1", // preferred VAPI TTS style, female
  "3", // male
  "2", // female
  "0", // female
  "Hej, den andra personen i detta samtal talar ett annat språk, du kommer att höra den andra personens röst och översättningen av deras tal. Denna funktion är möjlig genom att använda Vonage programmerbara kommunikationstjänster. Tack!", // standard greeting
  "Hej", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (svSE);

const taIN = [
  "ta-IN",
  "தமிழ் (Tamil)",
  "1", // preferred VAPI TTS style, male
  "0", // female
  "", 
  "", 
  "வணக்கம், இந்த அழைப்பில் உள்ள மற்றொரு நபர் வேறு மொழியைப் பேசுகிறார், மற்றவரின் குரலையும் அவர்களின் பேச்சின் மொழிபெயர்ப்பையும் நீங்கள் கேட்பீர்கள். வோனேஜ் நிரல்படுத்தக்கூடிய தகவல்தொடர்பு சேவைகளைப் பயன்படுத்துவதன் மூலம் இந்த அம்சம் சாத்தியமாகும். நன்றி!", // standard greeting
  "வணக்கம்", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (taIN);

const teIN = [
  "te-IN",
  "తెలుగు (Telugu)",
  "1", // preferred VAPI TTS style, male
  "0", // female
  "", 
  "", 
  "హలో, ఈ కాల్‌లోని ఇతర వ్యక్తి మరొక భాష మాట్లాడుతున్నాడు, మీరు అవతలి వ్యక్తి వాయిస్ మరియు వారి ప్రసంగం యొక్క అనువాదం వింటారు. వొనేజ్ ప్రోగ్రామబుల్ కమ్యూనికేషన్ సేవలను ఉపయోగించడం ద్వారా ఈ ఫీచర్ సాధ్యమవుతుంది. ధన్యవాదాలు!", // standard greeting
  "హలో", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (teIN);

const thTH = [
  "th-TH",
  "ไทย (Thai)",
  "1", // preferred VAPI TTS style, female
  "0", // female
  "", 
  "", 
  "สวัสดี บุคคลอื่นในสายนี้กำลังพูดภาษาอื่น คุณจะได้ยินเสียงของอีกฝ่าย และคำแปลคำพูดของพวกเขา คุณลักษณะนี้สามารถทำได้โดยใช้บริการสื่อสารที่ตั้งโปรแกรมได้ของ Vonage ขอขอบคุณ!", // standard greeting
  "สวัสดี", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (thTH);

const trTR = [
  "tr-TR",
  "Türk (Turkish)",
  "7", // preferred VAPI TTS style, male
  "4", // female
  "6", // or "5", male
  "3", // or "1", female
  "Merhaba, bu görüşmedeki diğer kişi başka bir dil konuşuyor, diğer kişinin sesini ve konuşmalarının çevirisini duyacaksınız. Bu özellik, Vonage programlanabilir iletişim servislerini kullanarak mümkündür. Teşekkürler!", // standard greeting
  "Merhaba", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (trTR);

const ukUA = [
  "uk-UA",
  "Українська (Ukrainian)",
  "0", // female
  "", 
  "", 
  "", 
  "Привіт, інша особа, яка спілкується за цим викликом, розмовляє іншою мовою, ви почуєте голос іншої особи та переклад її мови. Ця функція можлива за допомогою програмованих служб зв'язку Vonage. Дякую!", // standard greeting
  "Здравствуйте", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (ukUA);

const viVN = [
  "vi-VN",
  "Tiếng Việt (Vietnamese)",
  "3", // preferred VAPI TTS style, male
  "0", // female
  "2", // male
  "1", // female
  "Xin chào, người khác trong cuộc gọi này đang nói một ngôn ngữ khác, bạn sẽ nghe thấy giọng nói của người kia và bản dịch bài phát biểu của họ. Tính năng này có thể thực hiện được bằng cách sử dụng các dịch vụ truyền thông có thể lập trình của Vonage. Cảm ơn bạn!", // standard greeting
  "Xin chào", // short greeting
  "", // speak now
  "", // enter number to dial, 2nd-stage dialing
  "", // pls wait before speaking
  "", // select the language you will use to speak
  "", // custom voice prompt 1
  ""  // custom voice prompt 2
  ];
addToLangSetting (viVN);

// cy-GB ASR/STT does not exist with Google Speech-to-Text engine
// const cyGB = [
//   "cy-GB",
//   "Cymraeg (Welsh)",
//   "0", // female
//   "", 
//   "", 
//   "", 
//   "Helo, mae'r person arall ar yr alwad hon yn siarad iaith arall, byddwch chi'n clywed llais y person arall, a chyfieithiad ei araith. Mae'r nodwedd hon yn bosibl trwy ddefnyddio gwasanaethau cyfathrebu rhaglenadwy Vonage. Diolch!", // standard greeting
//   "Helo", // short greeting
//   "", // speak now
//   "", // enter number to dial, 2nd-stage dialing
//   "", // pls wait before speaking
//   "", // select the language you will use to speak
//   "", // custom voice prompt 1
//   ""  // custom voice prompt 2
//   ];
// addToLangSetting (cyGB);

console.log ("Language settings:", langSetting);

//-------------------------------------------------------------

let confAndPhoneNumbers = {};

function addToConfAndPhoneNumbers (info) {
  if (confAndPhoneNumbers[info[0]] == undefined) {
    confAndPhoneNumbers[info[0]] = {};  // dictionary, info[0] is the conference name, e.g. "1_1640658883"
  }
  confAndPhoneNumbers[info[0]][info[1]] = {};  // 2nd level dictionary, info [1] is participant's user ID
  confAndPhoneNumbers[info[0]][info[1]]["number"] = info[2];  // participant's E.164 number
  confAndPhoneNumbers[info[0]][info[1]]["locale"] = info[3];  // participant's language locale
  confAndPhoneNumbers[info[0]][info[1]]["userName"] = info[4];  // participant's user name or role
  confAndPhoneNumbers[info[0]][info[1]]["announcement"] = info[5]; // participant's type of announcement
  confAndPhoneNumbers[info[0]][info[1]]["callUuid"] = ''; // participant's VAPI call leg uuid
}

function deleteUserIdFromConfAndPhoneNumbers (confName, userId) {
  // TBD, check here that both uuids fields are empty before deleting confNumber entry from dictionary

  delete confAndPhoneNumbers[confName][userId];

  // return success or error code if cannot delete
}

function deleteFromConfAndPhoneNumbers (confName) {

  delete confAndPhoneNumbers[confName];

}

//-- test

// const confNumA1 = ['1_1640658883', '1', '12995550101', 'en-US', 'Agent', 'shortGreeting'];
// const confNumA2 = ['1_1640658883', '2', '12995550202', 'es-MX', 'Customer', 'standardGreeting'];

// const confNumB1 = ['1_1640658884', '1', '129995550303', 'fr-FR', 'Agent', 'shortGreeting'];
// const confNumB2 = ['1_1640658884', '2', '129995550304', 'it-IT', 'Customer', 'standardGreeting'];

// addToConfAndPhoneNumbers(confNumA1);
// addToConfAndPhoneNumbers(confNumA2);
// addToConfAndPhoneNumbers(confNumB1);
// addToConfAndPhoneNumbers(confNumB2);

// console.log ("Conference numbers:", confAndPhoneNumbers);

//-- end test

//-------------------------------------------------------------

function sixDigitRandomNumber() {

  const randomNumber = Math.floor(Math.random() * (999999 - 100000) + 100000);

  return (randomNumber);
}

//-------------------------------------------------------------

console.log("Service phone number:", servicePhoneNumber);

//-------------------------------------------------------------

let placedCalls = {}; // track number of calls to a given number

//--

function addToPlacedCalls(phoneNumber) {

  if (placedCalls[phoneNumber] == undefined) {
    placedCalls[phoneNumber] = 0;
  };

  let incrementCalls = true;

  for (const number of whiteListedNumbers) {
    if (number == phoneNumber) {
      console.log(">>> this is a whitelisted number:", phoneNumber);
      incrementCalls = false;
    }
  }

  if (incrementCalls) {
    placedCalls[phoneNumber]++;  // increase the count
  }

  console.log (">>> placedCalls dictionary:", placedCalls); 
}

//-------------------------------------------------------------

let callLegsInConf = {};  // store all call legs uuid for each active conference

//--

function addToCallLegsInConf(confName, uuid) {

  if (callLegsInConf[confName] == undefined) {
    callLegsInConf[confName] = new Set();
  };

  callLegsInConf[confName].add(uuid);

  console.log ("callLegsInConf dictionary:", callLegsInConf); 
}

//--

function removeFromCallLegsInConf(confName, uuid) {

  callLegsInConf[confName].delete(uuid);
  console.log ("callLegsInConf dictionary:", callLegsInConf); 

}

//---------------------------------------------------------

let uuids = {}; // map uuid to caller number, for incoming calls

function addToUuids(uuid, number) {

  uuids[uuid] = {};
  uuids[uuid]['number'] = number;
  console.log ("uuids dictionary:", uuids); 

}

function removeFromUuids(uuid) {

  delete uuids[uuid];
  console.log ("uuids dictionary:", uuids); 

}

//===========================================================

function reqCallback(error, response, body) {
    if (body != "Ok") {  
      console.log("HTTP request call status:", body);
    };  
}

//-----------

app.get('/langlist', (req, res) => {

  // return list of available language locales to a client application 

  let langList = {};

  for(const key in langSetting){
    langList[key] = langSetting[key]["commonName"];
    // langList.push({key: langSetting[key]["commonName"]});
  }



  res.status(200).json(langList);

});

//-----------

app.get('/simplelanglist', (req, res) => {

  // return list of available language locales to a client application 

  let simpleLangList = {};
  let i = 1;

  for(const key in langSetting){
    simpleLangList[i++] = langSetting[key]["commonName"];
  }


  res.status(200).json(simpleLangList);

});

//--- set up conference and corresponding phone number and language locale pairs ------------

// app.post('/conferencenumber', (req, res) => {

//   const conferenceName = req.body.conferenceName;
//   const userId = req.body.userId;
//   const number = req.body.number;
//   const languageCode = req.body.languageCode;
//   const userName = req.body.userName;
//   const announcement = req.body.announcement;

//   // TBD: check if new conferenceName already exists --> if yes, return error code, and ask to submit new registration

//   for (const existingConfName in confAndPhoneNumbers) {
//     for (const existingUserId in confAndPhoneNumbers[existingConfName]) {
//         if (confAndPhoneNumbers[existingConfName][existingUserId]['number'] == number) {
//           deleteUserIdFromConfAndPhoneNumbers(existingConfName, existingUserId);  // a given number can exist only in one named conference
                                                            
//           // TBD, delete confName entry if empty
//           if (Object.keys(confAndPhoneNumbers[existingConfName]).length === 0) {
//             deleteFromConfAndPhoneNumbers(existingConfName); // remove confName from dictionary if there are no associated numbers
//           }

//         };
//     }
//   }; 

//   // --

//   let newConfNumberCreated = true;

//   do {
//     confNumber = sixDigitRandomNumber();

//     for (const existingConfNumber in confAndPhoneNumbers) {    
//       if (existingConfNumber == confNumber) { newConfNumberCreated = false };
//     };

//   } while (!newConfNumberCreated)

//   //----------------------------------------

//   addToConfAndPhoneNumbers([conferenceName, userId, number, languageCode, userName, announcement]); // add new entry to dictionary of conference numbers

//   console.log ("Conference numbers:", confAndPhoneNumbers);

//   res.status(200).send('Ok');

  // TBD
  // res.status(200).send('Conference name already exists');

// });

//--- just testing making calls from a local request -----------------

app.get('/makecall', (req, res) => {

  res.status(200).send('Ok');

  const hostName = `${req.hostname}`;

  let callInfo;
  let reqOptions;

  //-- call 1 ---

  callInfo = {
    'type': 'phone',
    'number': '12095551212', // one the parties to call
    'languageCode': 'es-US', // should be a different language from call 2 below
    'userId': 'abcde', // try to have a unique ID for each participant
    'userName': 'myVBC', // may be empty
    'conferenceName': '22334699', // unique for each conference call, all digits for the use case here
    'conferencePin': '', // must be all digits, future usage
    'announcement': 'shortGreeting', // 'standardGreeting', 'shortGreeting', 'speakNow', 'enterNumber', 'wait', 'none', 'selectLang', 'custom1', 'custom2'
    'x_param_1': 'foo1',
    'x_param_2': 'foo2'
  };

  console.log("callInfo:", JSON.stringify(callInfo));

  reqOptions = {
    url: 'https://' + hostName + '/placecall',
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(callInfo)
  };

  request(reqOptions, reqCallback);

  //-- call 2 ---

    callInfo = {
    'type': 'phone',
    'number': '12095551313', // other party to call
    'languageCode': 'en-US', // should be a different language from call 1 above
    'userId': 'fghijk', // may be empty
    'userName': 'myCell', // may be empty
    'conferenceName': '22334699', // unique for each conference call (but same as for call 1), all digits for the use case here
    'conferencePin': '', // must be all digits, future usage
    'announcement': 'shortGreeting', // 'standardGreeting', 'shortGreeting', 'speakNow', 'enterNumber', 'wait', 'none', 'selectLang', 'custom1', 'custom2'
    'x_param_3': 'bar1',
    'x_param_4': 'bar2'
  };

  console.log("callInfo:", JSON.stringify(callInfo));

  reqOptions = {
    url: 'https://' + hostName + '/placecall',
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(callInfo)
  };

  request(reqOptions, reqCallback);

});

//-----------------

app.post('/placecall', (req, res) => {

  res.status(200).send('Ok');

  const hostName = `${req.hostname}`;

  const languageCode = req.body.languageCode;
  const userId = req.body.userId;
  const userName = req.body.userName;
  const conferenceName = req.body.conferenceName;
  const conferencePin = req.body.conferencePin;  // future usage
  const announcement = req.body.announcement;
  const numberToCall = req.body.number;

  let xCustomFields = [];
  let customQueryParams = '';

  for (const [key, value] of Object.entries(req.body)) {
    console.log(`${key}: ${value}`);
    if (`${key}`.substring(0, 2) == 'x_') {
      xCustomFields.push(`${key}=${value}`);
    }
  }

  if (xCustomFields.length != 0) {
    customQueryParams = "&" + xCustomFields.join("&");
  };

  console.log('>>> custom query parameters in placecall:', customQueryParams);

  if (limitCalls) {

    addToPlacedCalls(numberToCall);
    // to do: create logic to block other call in the pair
  };  


  if ((placedCalls[numberToCall] > maxCallsPerDay) && limitCalls) {

    // no call is made

    if (vids) { // display notice message in VIDS

      const chunkUuid = uuidv4();

      let errormsg1 = {
        'vapiUuid': 0, // does not matter
        'chunkUuid': chunkUuid, 
        'transcript': "You have reached the max allowed number of calls for today.",
        'sourceLanguageCode': languageCode, // does not matter
        'userName': userName, // does not matter
        'userId': userId, // does not matter
        'confName': conferenceName
      };

      errormsg1["timestamp"] = Date.now();
      console.log('>>> posted info:', errormsg1)

      // post here to front end GUI if any

      //-

      let errormsg2 = {
        'vapiUuid': 0, // does not matter
        'chunkUuid': chunkUuid,
        'translation': "You have reached the max allowed number of calls for today.",
        'targetLanguageCode': languageCode, // does not matter
        'userName': userName, // does not matter
        'userId': userId, // does not matter
        'confName': conferenceName
      };

      errormsg2["timestamp"] = Date.now();
      console.log('>>> posted info:', errormsg2)

      // post here to front end GUI if any

    };

  } else {

    switch(req.body.type){

      case "phone":

        vonage.calls.create({
          to: [{
            type: 'phone',
            number: numberToCall
          }],
          from: {
           type: 'phone',
           number: servicePhoneNumber
          },
          answer_url: ['https://' + hostName + '/answer_lang?language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&conference_pin=' + conferencePin + '&announcement=' + announcement + customQueryParams],
          answer_method: 'GET',
          event_url: ['https://' + hostName + '/event_lang?language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&conference_pin=' + conferencePin + '&announcement=' + announcement + customQueryParams],
          event_method: 'POST'
          }, (err, res) => {
          if(err) {
            console.error(">>> outgoing call error:", err);
            console.error(err.body.title);
            console.error(err.body.invalid_parameters);
          } else {
            console.log(">>> outgoing call status:", res);
          }
        });

      break;

      // other call types will be added

      default:
        console.log("Unsupported call type:", type);
    }

  };  

});

//-------

app.get('/answer_lang', (req, res) => {

    const hostName = `${req.hostname}`;

    const languageCode = req.query.language_code;
    const userId = req.query.user_id;
    const userName = req.query.user_name;
    const conferenceName = req.query.conference_name;
    const conferencePin = req.query.conference_pin;  // future usage

    // TBD set text in relevant message for announcement

    let nccoResponse = [
        // {
        //   "action":"talk",
        //   "text": ....,
        //   "style": ...,
        // },
        {
          "action": "conversation",
          "name": req.query.conference_name,
          "startOnEnter": true,
          "endOnExit": true // valid ONLY for 1-to-1 case (not for multi-party), so it ends any websockets still up and other leg
        }
      ];

    res.status(200).json(nccoResponse);
});


//-------

app.post('/event_lang', (req, res) => {

  const hostName = `${req.hostname}`;
  const uuid = req.body.uuid;
  const languageCode = req.query.language_code;
  const userId = req.query.user_id;
  const userName = req.query.user_name;
  const conferenceName = req.query.conference_name;
  const conferencePin = req.query.conference_pin;  // future usage
  const announcement = req.query.announcement;

  // test
  console.log('conferenceName:', req.query.conference_name);

  let xCustomFields = [];
  let customQueryParams = '';

  for (const queryParameter in req.query){    
    if (`${queryParameter}`.substring(0, 2) == 'x_') {
      xCustomFields.push(`${queryParameter}=${req.query[`${queryParameter}`]}`);
    }
  }

  // console.log('in event_lang xCustomFields:', xCustomFields);

  if (xCustomFields.length != 0) {
    customQueryParams = "&" + xCustomFields.join("&");
  };

  // console.log('in event_lang customQueryParams:', customQueryParams);

  //--

  if (req.body.type == 'transfer'){

    addToCallLegsInConf(conferenceName, uuid);

    const wsUri = 'wss://' + processorServer + '/socket?original_uuid=' + req.body.uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&webhook_url=https://' + hostName + '/results' + customQueryParams; 
    console.log('>>> websocket URI:', wsUri);

    // create corresponding websocket
    vonage.calls.create({
       to: [{
         type: 'websocket',
         uri: wsUri,
         'content-type': 'audio/l16;rate=16000',  // NEVER change the content-type parameter argument
         headers: {}
        }],
       from: {
         type: 'phone',
         number: 19999999999 // cannot use a longer than 15-digit string (e.g. not call_uuid)
       },
       answer_url: ['https://' + hostName + '/ws_answer?original_uuid=' + req.body.uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName],
       event_url: ['https://' + hostName + '/ws_event?original_uuid=' + req.body.uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&announcement=' + announcement]
      }, (err, res) => {
       if(err) {
                console.error(">>> websocket create error:", err);
                console.error(err.body.title);
                console.error(err.body.invalid_parameters);
                }
       else { console.log(">>> websocket create status:", res); }
    });

  };  

  //--

  if (req.body.status == 'completed'){

    removeFromCallLegsInConf(conferenceName, uuid);
  
  };

  //---- limit call duration if flag is set

  if ((req.body.status == 'answered') && limitCalls) {

    // in the future, maybe not limit duration of whitelisted numbers?
    // need to pass/receive called number in the received query parameters

    setTimeout(() => {

      vonage.calls.talk.start(uuid,  
        {
        text: langSetting['en-US']['custom1'],
        language: 'en-US', 
        style: langSetting['en-US']['vapiTtsStyle0']
        }, (err, res) => {
           if (err) { console.error('Talk ', uuid, 'error: ', err, err.body.invalid_parameters); }
           else {
             console.log('Talk ', uuid, 'status: ', res);
        }
      });

    }, maxCallDuration);    

    setTimeout(() => {
      // tbd, check if call is still up first, optimization, not essential

      vonage.calls.update(uuid, {action: 'hangup'}, (err, res) => {
          if (err) { console.error('>>> Call ' + uuid + ' reached max duration tear down error', err); }
          else {console.log ('>>> Call ' + uuid + ' reached max duration - Stopped!')};
      });
    }, maxCallDuration + ttsCustom1Duration);  
 
  };

  //--

  res.status(200).json({});
});


//-------

app.get('/answer', (req, res) => {

  // incoming call
  // in the near future, ask for conference number (and possibly conference PIN), 
  // in the future, possibly handle IVR played in local language, remote party's number to call and their language
  // incoming call is accepted only if present in list of allowed numbers in confAndPhoneNumbers dictionary

  // create websocket only after call is transferred to conference
  // otherwise canHear of websocket may fail to properly work

  const uuid = req.query.uuid;
  
  app.set('call_type_' + uuid, notWebsocket);

  const hostName = `${req.hostname}`;

  // check first that caller number is authorized

  const callerNumber = req.query.from;
  console.log('callerNumber:', callerNumber); // caller number as received from carrier, SIP interconnect, or Viber network

  const callerNumberLastDigits = callerNumber.substring(callerNumber.length - lastDigits); // last digits of the caller number
  console.log('callerNumberLastDigits:', callerNumberLastDigits);

  let nccoResponse = [];
  let callAllowed = false;
  let confName = '';

  for (const existingConfName in confAndPhoneNumbers) {
    for (const existingUserId in confAndPhoneNumbers[existingConfName]) {
        if (confAndPhoneNumbers[existingConfName][existingUserId]['number'].substring(confAndPhoneNumbers[existingConfName][existingUserId]['number'].length - lastDigits) == callerNumberLastDigits) {
          callAllowed = true;
          confName = existingConfName;
        };
    }
  }; 

  if (callAllowed) {

    addToUuids(uuid, callerNumber); // map uuid to caller number (for transfer in /event webhook)

    // TBD, check if there is already a call established from same caller, if yes end that new call
    // (with announcement in corresponding lamguage locale)

    // TBD, IVR asking to enter conference number, play prompt in corresponding language locale

    // put in conference using the conference number as name suffix
    nccoResponse = [
        {
          "action": "conversation",
          "name": confName,
          "startOnEnter": true,
          "endOnExit": true // valid ONLY for 1-to-1 calls (not for multi-party conference calls), so it ends any websockets still up and the other's participant call leg
        }
      ];
  } else {
    nccoResponse = [
      {
        "action": "talk",
        "text": "Hello, you are not registered to call this Vonage live translation service. This call is now terminated. Good bye!",
        "style": "11"
     }
    ];
  };

  res.status(200).json(nccoResponse);

});

//--------

app.post('/event', (req, res) => {

  const hostName = `${req.hostname}`;
  const uuid = req.body.uuid;

  if (req.body.type == 'transfer'){
    
    const uuid = req.body.uuid;
    
    // let confNumber;
    let languageCode;
    let phoneNumber;
    let conferenceName;
    let userId;
    let userName;
    let announcement;

    // get caller number from uuid
    const callerNumber = uuids[uuid]['number'];
    console.log('callerNumber:', callerNumber); // caller number as received from carrier, SIP interconnect, or Viber network

    const callerNumberLastDigits = callerNumber.substring(callerNumber.length - lastDigits); // last digits of the caller number
    console.log('callerNumberLastDigits:', callerNumberLastDigits);

    for (const existingConfName in confAndPhoneNumbers) {
      for (const existingUserId in confAndPhoneNumbers[existingConfName]) {
          if (confAndPhoneNumbers[existingConfName][existingUserId]['number'].substring(confAndPhoneNumbers[existingConfName][existingUserId]['number'].length - lastDigits) == callerNumberLastDigits) {
            conferenceName = existingConfName;
            userId = existingUserId;
            phoneNumber = confAndPhoneNumbers[existingConfName][existingUserId]['number'];
            languageCode = confAndPhoneNumbers[existingConfName][existingUserId]['locale'];
            announcement = confAndPhoneNumbers[existingConfName][existingUserId]['announcement'];
            userName = confAndPhoneNumbers[existingConfName][existingUserId]['userName'];
          };
      }
    }; 

    // TBD, check what this function is used for
    addToCallLegsInConf(conferenceName, uuid);
 
    console.log('in /event webhook');
    console.log('conferenceName:', conferenceName);
    console.log('userId:', userId);
    console.log('phoneNumber:', phoneNumber);
    console.log('languageCode:', languageCode);
    console.log('announcement:', announcement);
    console.log('userName:', userName);

    const wsUri = 'wss://' + processorServer + '/socket?original_uuid=' + uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&webhook_url=https://' + hostName + '/results'; 
    console.log('>>> websocket URI:', wsUri);

    // create corresponding websocket
    vonage.calls.create({
       to: [{
         type: 'websocket',
         uri: wsUri,
         'content-type': 'audio/l16;rate=16000',  // NEVER change the content-type parameter argument
         headers: {}
        }],
       from: {
         type: 'phone',
         number: 19999999999 // cannot use a longer than 15-digit string (e.g. not call_uuid)
       },
       answer_url: ['https://' + hostName + '/ws_answer?original_uuid=' + req.body.uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName],
       event_url: ['https://' + hostName + '/ws_event?original_uuid=' + req.body.uuid + '&language_code=' + languageCode + '&user_id=' + userId + '&user_name=' + userName + '&conference_name=' + conferenceName + '&announcement=' + announcement]
      }, (err, res) => {
       if(err) {
                console.error(">>> websocket create error:", err);
                // console.error(err.body.title);
                // console.error(err.body.invalid_parameters);
                }
       else { console.log(">>> websocket create status:", res); }
    });

  }  

  res.status(200).json({});
});

//-----------------------------------------

app.get('/ws_answer', (req, res) => {

  const originalUuid = req.query.original_uuid;
  const conferenceName = req.query.conference_name;
  
  // This stores the uuid be used to tear down this websocket (if conference does not have endOnExit true, i.e. multi-party use case)
  // app.set('ws_uuid_' + originalUuid , req.query.uuid)

  let nccoResponse = [
    {
      "action": "conversation",
      "canHear": [originalUuid],
      "name": conferenceName  // to handle multiple separate conf calls with RT translations
    }
  ];

  console.log ('>>> nccoResponse:\n', nccoResponse);

  res.status(200).json(nccoResponse);
});

//-----------------------------------------

app.post('/ws_event', (req, res) => {

  if (req.body.status == "answered") {
    
    console.log("Websocket uuid:", req.body.uuid);

    const originalUuid = req.query.original_uuid;

    const ttsLanguageCode = req.query.language_code;
    console.log('TTS language code:', ttsLanguageCode);

    const announcement = req.query.announcement;
    console.log('Announcement type:', announcement);
    
    // when user is called, this greeing is played
    const ttsText = langSetting[ttsLanguageCode][announcement];

    const ttsStyle = langSetting[ttsLanguageCode]['vapiTtsStyle0'];
    console.log('VAPI TTS style:', ttsStyle);

    vonage.calls.talk.start(originalUuid,  
      {
      text: ttsText,
      language: ttsLanguageCode, 
      style: ttsStyle,
      bargeIn: true
      }, (err, res) => {
         if (err) { console.error('Talk ', originalUuid, 'error: ', err); }
         else {
           console.log('Talk ', originalUuid, 'status: ', res);
           // TBD: add code to reset follwing paremeter to undefined in corresponding event webhook
           app.set('greeting_tts_' + originalUuid, res.uuid);
           console.log('greeting_tts_' + originalUuid, app.get('greeting_tts_' + originalUuid)); 
         }
    });


  //   setTimeout(() => {
  //     vonage.calls.talk.start(originalUuid, {text: announcement, voiceName: 'Emma', loop: 1}, (err, res) => {
  //       if (err) { console.error('>>> TTS to associated party ' + req.body.uuid + 'error:', err); }
  //       else {console.log ('>>> TTS to associated party ' + req.body.uuid + ' ok!')}
  //     });
  //   }, 4000);  

  };

  res.status(200).end();

  // TBD
  // send request for translation in additional languages to connecting server

});

//---------

app.post('/rtc', (req, res) => {

  res.status(200).json({});

});

//---------

app.post('/results', (req, res) => {

  res.status(200).send('Ok');

  const timeNow = Date.now();
  console.log('>>>', timeNow.toString());
  console.log(req.body);

  if (req.body.hasOwnProperty('translation')) {

    const targetLanguageCode = req.body.targetLanguageCode;

    // console.log(">>> TTS to be played - translation:", req.body.translation);
    console.log(">>> uuids of conference:", callLegsInConf[req.body.confName]);

    callLegsInConf[req.body.confName].forEach( uuid => {

      // Play translation TTS to call legs of the conference uuid

      const ttsStyle = langSetting[targetLanguageCode]['vapiTtsStyle0'];

      vonage.calls.talk.start(uuid,  
        {
        text: req.body.translation,
        language: targetLanguageCode, 
        style: ttsStyle
        }, (err, res) => {
           if (err) { console.error('Talk ', uuid, 'error: ', err); }
           else {
             console.log('Talk ', uuid, 'status: ', res);
        }
      });

    });

  }

});


//=========================================

app.use ('/', express.static(__dirname));

app.get('/:name', function (req, res, next) {

  let options = {
    // root: __dirname + '/public/',
    root: __dirname,
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };

  let fileName = req.params.name;
  res.sendFile(fileName, options, function (err) {
    if (err) {
      next(err);
    } else {
      console.log('Sent:', fileName);
    }
  });
});

//-----------

const port = process.env.PORT || 8000;

app.listen(port, () => console.log(`Server application listening on port ${port}!`));

//------------
