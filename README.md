# Real-time language translations for voice calls - Sample application - V2

## About this application

This application allows calling recipients speaking different languages and have phone conversations with real-time interpretation of their speech.</br>
This application uses Vonage Voice API and a Vonage managed backend service which together handle the real-time automated Automatic Speech Recognitions, Translations, and Text-to-Speech into target languages. 

Many real-time language intepreting use cases are supported. With this sample use case:
- This application uses Vonage Voice API:</br>
	- To place calls to two recipient phone numbers,</br>
	- For each recipient, establish a WebSocket to the Vonage backend service, aka connector service ("connector"), which will transmit the audio in real-time,</br>
	- To receive real-time transcriptions of original speeches and translation texts from the connector,</br>
	- Play translations of target languages using TTS (Text-To-Speech) to the recipients phones.</br>

## Local deployment using ngrok

If you plan to test using `Local deployment with ngrok` (Internet tunneling service) for this Vonage Voice API application, you may use the following instructions to set up ngrok:
- [Install ngrok](https://ngrok.com/download),
- Make sure you are using the latest version of ngrok and not using a previously installed version of ngrok,
- Sign up for a free [ngrok account](https://dashboard.ngrok.com/signup),
- Verify your email address from the email sent by ngrok,
- Retrieve [your Authoken](https://dashboard.ngrok.com/get-started/your-authtoken), 
- Run the command `ngrok config add-authtoken <your-authtoken>`
- Set up a tunnela
	- Run `ngrok config edit`
		- For a free ngrok account, add following lines to the ngrok configuration file (under authoken line):</br>
		<pre><code>	
		tunnels:
			eight:</br>
				proto: http</br>
				addr: 8000</br>
		</code></pre>
		- For a [paid ngrok account](https://dashboard.ngrok.com/billing/subscription), you may set ngrok hostnames that never change on each ngrok new launch, add following lines to the ngrok configuration file (under authoken line) - set hostnames to actual desired values:</br>
		<pre><code>	
		tunnels:
			eight:</br>
				proto: http</br>
				addr: 8000</br>
				hostname: setanamehere8.ngrok.io*</br>
		</code></pre>			
		Note: The Voice API application (this repository) will be running on local port 8000.
- Start the ngrok tunnel
	- Run `ngrok start eight`</br>
	- You will see lines like
		....</br>
		*Web Interface                 http://127.0.0.1:4040                             
		Forwarding                    https://yyyyyyy.ngrok.io -> http://localhost:8000*</br> 
	- Make note of *https://yyyyyyy.ngrok.io* (with the leading https://), as it will be needed in the next steps below.</br>	


## Non local deployment

If you are using hosted servers, for example Heroku, your own servers, or some other cloud provider,
you will need the public hostnames and if necessary public ports of the servers that
run the Voice API application (this repository),</br>
e.g.</br>
	*`myappname.herokuapp.com`, `myserver2.mycompany.com:40000`*</br>

  (no `port` is necessary with heroku as public hostname)

For Heroku deployment, see more details in the next section **Command Line Heroku deployment**.  

## Set up your Vonage Voice API application credentials and phone number

[Log in to your](https://ui.idp.vonage.com/ui/auth/login) or [sign up for a](https://ui.idp.vonage.com/ui/auth/registration) Vonage API account.

Go to [Your applications](https://dashboard.nexmo.com/applications), access an existing application or [+ Create a new application](https://dashboard.nexmo.com/applications/new).

Under **Capabilities** section (click on [Edit] if you do not see this section):

Enable Voice
- Under Answer URL, leave HTTP GET, and enter https://\<host\>:\<port\>/answer (replace \<host\> and \<port\> with the public host name and if necessary public port of the server where this sample application is running), e.g.</br>
*https://yyyyyyyy.ngrok.io/answer*</br>
or
*https://myappname.herokuapp.com/answer*</br>
or
*https://myserver2.mycompany.com:40000/answer*</br>
- Under Event URL, **select** **_HTTP POST_**, and enter https://\<host\>:\<port\>/event (replace \<host\> and \<port\> with the public host name and if necessary public port of the server where this sample application is running), e.g.</br>
*https://yyyyyyyy.ngrok.io/event*</br>
or
*https://myappname.herokuapp.com/event*</br>
or
*https://myserver2.mycompany.com:40000/event*</br>

- Click on [Generate public and private key] if you did not yet create or want new ones, then save as **.private.key** file (note the leading dot in the file name) in this application folder.</br>
**IMPORTANT**: Do not forget to click on [Save changes] at the bottom of the screen if you have created a new key set.</br>
- Link a phone number to this application if none has been linked to the application.

Please take note of your **application ID** and the **linked phone number** (as they are needed in the very next section.)

For the next steps, you will need:</br>
- Your [Vonage API key](https://dashboard.nexmo.com/settings) (as **`API_KEY`**)</br>
- Your [Vonage API secret](https://dashboard.nexmo.com/settings), not signature secret, (as **`API_SECRET`**)</br>
- Your `application ID` (as **`APP_ID`**),</br>
- The **`phone number linked`** to your application (as **`SERVICE_NUMBER`**),</br>
- Set the **`PROCESSOR_SERVER`** parameter with the value that is supplied to you by your Vonage technical contact (e.g. Vonage CSA or CSE), the argument has no http:// nor https:// prefix, no trailing /, and no sub-path, e.g.</br>
*xxxxxx.herokuapp.com*</br>
or
*api-us.vonage.com/v1/neru/i/xxxx-connector*</br>

## Setting up phone numbers to call

Edit the file rti-voice-app-v2.js

Find the line with the content:
app.get('/makecall', (req, res) => {

Below that line, in sections
//-- call 1 ---
and
//-- call 2 ---	

Update the phone numbers (field _'number'_) to actual recipient phone numbers of two participants that will be speaking different languages. Phone numbers need to be in E.164 format (i.e. with country code), no international dial prefix (such as 011, or 00), no leading + sign.

Update also their respective corresponding language codes (field _'languageCode'_).

Save and close the file rti-voice-app-v2.js

## Running this sample Voice API application

You may select one of the following 2 types of deployments.

### Local deployment

To run your own instance of this sample application locally, you'll need an up-to-date version of Node.js (we tested with version 16.15.1).

Download this sample application code to a local folder, then go to that folder.

Copy the `env.example` file over to a new file called `.env` (with leading dot):
```bash
cp env.example .env
```

Edit `.env` file, and set the first five parameter values:</br>
API_KEY=</br>
API_SECRET=</br>
APP_ID=</br>
PROCESSOR_SERVER=</br>
SERVICE_NUMBER=</br>
LIMITCALLS=true</br>

Install dependencies once:
```bash
npm install
```

Make sure ngrok has been already started as explained in previous section.

Launch the application:
```bash
node rti-voice-app-v2
```

### Command Line Heroku deployment

You must first have deployed your application locally, as explained in previous section, and verified it is working.

Install [git](https://git-scm.com/downloads).

Install [Heroku command line](https://devcenter.heroku.com/categories/command-line) and login to your Heroku account.

If you do not yet have a local git repository, create one:</br>
```bash
git init
git add .
git commit -am "initial"
```

Start by creating this application on Heroku from the command line using the Heroku CLI:
*Note: In following command, replace "myappname" with a unique name on the whole Heroku platform*

```bash
heroku create myappname
```

On your Heroku dashboard where your application page is shown, click on `Settings` button,
add the following `Config Vars` and set them with their respective values:</br>
API_KEY</br>
API_SECRET</br>
APP_ID</br>
PROCESSOR_SERVER</br>
SERVICE_NUMBER</br>
LIMITCALLS with the value **true**</br>

Now, deploy the application:


```bash
git push heroku master
```

On your Heroku dashboard where your application page is shown, click on `Open App` button, that hostname is the one to be used under your corresponding [Vonage Voice API application Capabilities](https://dashboard.nexmo.com/applications) (click on your application, then [Edit]).</br>

For example, the respective links would be (replace *myappname* with actual value):</br>
https://myappname.herokuapp.com/answer</br>
https://myappname.herokuapp.com/event</br>

See more details in above section **Set up your Vonage Voice API application credentials and phone number**.


### Making test calls 

Open a web browser, access the path /makecall, for example
```bash
xxxxxx.ngrok.io/makecall
```
or
```bash 
xxxxxx.herokuapp.com/makecall
```

The recipient phones will be called, both recipients in the phone call may speak their own language and hear real-time interpretation of their speech.


### Available language locale codes

Open a web browser, access the path /langlist, for example
```bash
xxxxxx.ngrok.io/langlist
```
or
```bash 
xxxxxx.herokuapp.com/langlist
```

You will get in return the list of language codes in a JSON formatted reply


### Available language locale names

Open a web browser, access the path /simplelanglist, for example
```bash
xxxxxx.ngrok.io/simplelanglist
```
or
```bash 
xxxxxx.herokuapp.com/simplelanglist
```

You will get in return the list of language locale names in a JSON formatted reply