/*
This file is part of the Le Mans Spam Zimlet.
Copyright (C) 2019 Stéphane Gosnet

Bugs and feedback: https://github.com/sgosnet/zimlet-spam

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see http://www.gnu.org/licenses/.
*/

/*
 * Version 1.0 : 01/21/2019
 * Version 1.1 : 01/23/2019
 *		Correction pas d'envoi si action sur le bouton "Pas du spam"
*
 * Reste à faire :
 *   - Surcharge menu contextuel Déclarer comme spam sur liste des messages
 *
 * Bugs :
 *   - Les notifications ne fonctionnent pas toujours
 */


/**
 * Cette Zimlet surcharge le bouton Spam des messages et les envoie vers le Helpdesk.
 */
fr_lemans_spam_HandlerObject = 
function(){
};

fr_lemans_spam_HandlerObject.prototype = new ZmZimletBase();
fr_lemans_spam_HandlerObject.prototype.constructor = fr_lemans_spam_HandlerObject;

/**
 * Initialises la zimlet en appelant la fonction replaceMailToolBarListerner sur la vue actuelle.
 */
fr_lemans_spam_HandlerObject.prototype.init =
function() {
	this.replaceMailToolbarBtnListener(ZmId.OP_SPAM, new AjxListener(this, this._newSelectionListener));
};


/**
 * Fonction replaceMailToolbarBtnListerner
 * Remplace le listener du bouton Spam/No Spam pour les vues de type MAIL (CLV, TV, CV,MSG).
 */
fr_lemans_spam_HandlerObject.prototype.replaceMailToolbarBtnListener = function(btnName, newListner) {
	var controller = null;
	var btn  = null;

	//Intialise le tableau de conservation des vues dont le listener a été remplacé
	if (this._viewHasNewListner == undefined) {
		this._viewHasNewListner = [];
	}

	// Appel du bouton Spam de la vue s'il s'agit d'une vue de type Message
	var viewId = appCtxt.getAppViewMgr().getCurrentViewId();
    var viewType = appCtxt.getAppViewMgr().getCurrentViewType();
	if (viewType != "CLV" && viewType != "TV" && viewType != "CV" && viewType != "MSG") {
		return;
	} else {
                controller = appCtxt.getCurrentController();
                btn = controller._toolbar[viewId].getButton(btnName);
	}

	// Remplacement du listener si pas déjà fait
	if (this._viewHasNewListner[viewId]) { //already has listener
		return;
	} else {
		this._viewHasNewListner[viewId] = true;
		// btn.removeSelectionListeners();  // Retire l'ancien Listerner du bouton
		btn.addSelectionListener(newListner);
	}
};

/**
 * Sur changement de vue, remplace les listeners des boutons Spam pour les vues de types MAIL (CLV, TV, CV, MSG).
 */
fr_lemans_spam_HandlerObject.prototype.onShowView = function (viewId, isNewView) {

	var viewType = appCtxt.getAppViewMgr().getCurrentViewType();

	if (viewType == "CLV" || viewType == "TV" || viewType == "CV" || viewType == "MSG") {
		this.replaceMailToolbarBtnListener(ZmId.OP_SPAM, new AjxListener(this, this._newSelectionListener));
	}
};

/*
 * Nouveau  Listerner sur bouton Spam
 */
fr_lemans_spam_HandlerObject.prototype._newSelectionListener = function(obj) {

	var zimletInstance = appCtxt._zimletMgr.getZimletByName('fr_lemans_spam').handlerObject;
	var helpdeskMail = zimletInstance._zimletContext.getConfig("helpdeskMail");
	var helpdeskName = zimletInstance._zimletContext.getConfig("helpdeskName");
	var spamPrefix = zimletInstance._zimletContext.getConfig("spamPrefix");
	var spamNoSend = zimletInstance._zimletContext.getConfig("spamNoSend");
	var spamSujet = this.getMessage("frlemansspam_Mailsujet");
	var spamContenu = this.getMessage("frlemansspam_Mailcontenu");

	var selection = this.getSelectMsgIds();
	if(selection != false){
		for(var i=0; i < selection.length; i++){
console.log("[LMM Spam] Message("+(i+1)+"/"+selection.length+") "+selection[i]);
				if(selection[i] != null && selection[i] != undefined){
					this.sendEmails(selection[i],helpdeskMail,spamPrefix + spamSujet, spamContenu + this.notifyAttribs(this.getMailContent(selection[i])),spamNoSend);
				}
		}
	
		// Notification utilisateur
		if(selection.length  == 1){
console.log("[LMM Spam] " + selection.length + " " + this.getMessage("frlemansspam_Notif") + " " + helpdeskName+" !");
			appCtxt.getAppController().setStatusMsg(selection.length + " " + this.getMessage("frlemansspam_Notif") + " " + helpdeskName+" !",ZmStatusView.LEVEL_WARNING);
		} else {
console.log("[LMM Spam] " + selection.length + " " + this.getMessage("frlemansspam_Notifs") + " " + helpdeskName+" !");
			appCtxt.getAppController().setStatusMsg(selection.length + " " + this.getMessage("frlemansspam_Notifs") + " " + helpdeskName+" !",ZmStatusView.LEVEL_WARNING);
		}
	}
};


/*
 *  Recherche des attributs dans le spam
*/
fr_lemans_spam_HandlerObject.prototype.notifyAttribs = function (mail) {

	// Lecture des attributs à rechercher dans la configuration de la Zimlet 
	var zimletInstance = appCtxt._zimletMgr.getZimletByName('fr_lemans_spam').handlerObject;
	var spamAttribs = zimletInstance._zimletContext.getConfig("spamAttributs");
	spamAttribs = spamAttribs.split(";");

	// Parcours du mail et recherche des attributs
	var contenuAttributs = "";
	var lignes = mail.split("\n");
	for (i=0 ; i < spamAttribs.length ; i++){
		var pattern = new RegExp(spamAttribs[i]);
		for(l=0 ; l < lignes.length ; l++){
			if(pattern.test(lignes[l]))
				contenuAttributs = contenuAttributs + lignes[l] + "<br>";
		}
	}
	return contenuAttributs;
};

/*
* Récupère liste des messages sélectionnés
*/
fr_lemans_spam_HandlerObject.prototype.getSelectMsgIds = function()
{
	var selectedMsgIds = new Array();
	var selectedConvIds = new Array();
	var message_selected = appCtxt.getCurrentController().getItems();
	
	// Si pas de messages sélectionné ou messages dans dossier Spam, retourne rien
	// folderID 4 : dossier spam.
	if (message_selected == null || message_selected.length == 0 || message_selected[0].folderId == "4")
		return false;

	for ( var i = 0; i < message_selected.length; i++)
	{
		var messageItem = message_selected[i];
		if (messageItem.msgIds == undefined || messageItem.msgIds.length == 0)
		{
			selectedMsgIds.push(messageItem.id);
		}
		else
		{
			selectedConvIds.push(messageItem.id);
			for ( var j = 0; j < messageItem.msgIds.length; j++)
			{
				selectedMsgIds.push(messageItem.msgIds[j]);
			}
		}
	}
	return selectedMsgIds;
};

/*
 * Récupère le message
*/
fr_lemans_spam_HandlerObject.prototype.getMailContent = function(msgId)
{
	var url =
	[];
	var j = 0;
	var proto = location.protocol;
	var port = Number(location.port);
	url[j++] = proto;
	url[j++] = "//";
	url[j++] = location.hostname;
	if (port && ((proto == ZmSetting.PROTO_HTTP && port != ZmSetting.HTTP_DEFAULT_PORT) || (proto == ZmSetting.PROTO_HTTPS && port != ZmSetting.HTTPS_DEFAULT_PORT)))
	{
		url[j++] = ":";
		url[j++] = port;
	}
	url[j++] = "/home/";
	url[j++] = AjxStringUtil.urlComponentEncode(appCtxt.getActiveAccount().name);
	url[j++] = "/message.txt?fmt=eml&id=";
	url[j++] = msgId;

	var getUrl = url.join("");
	var response = AjxRpc.invoke(null, getUrl, null, null, true);

	return response.text;
}

/*
 * Envoi le message par WebService JSON
*/
fr_lemans_spam_HandlerObject.prototype.sendEmails = function(messageSelected, emailAddressToSend, subject, emailBody, noSend)
{
	// Send email to FBL
	var msgIds =
	[];
	msgIds.push(
	{
		id : messageSelected < 0 ? -messageSelected : messageSelected
	});

	var jsonObj =
	{
		SendMsgRequest :
		{
			_jsns : "urn:zimbraMail"
		}
	};

	var request = jsonObj.SendMsgRequest;
	request.suid = (new Date()).getTime();

	noSend == "true" ? request.noSave = "1" : request.noSave = "0"; // dont save to send

	var msgNode = request.m =
	{};
	request.m.attach =
	{};
	request.m.attach.m = msgIds;
	var identity = appCtxt.getIdentityCollection().defaultIdentity;
	msgNode.idnt = identity.id;

	var isPrimary = identity == null || identity.isDefault;
	var mainAcct = appCtxt.accountList.mainAccount.getEmail();
	var addr = identity.sendFromAddress || mainAcct;
	var displayName = identity.sendFromDisplay;
	var addrNodes = msgNode.e =
	[];
	var f_addrNode =
	{
		t : "f",
		a : addr
	};
	if (displayName)
	{
		f_addrNode.p = displayName;
	}
	addrNodes.push(f_addrNode);

	var t_addrNode =
	{
		t : "t",
		a : emailAddressToSend
	};
	if (displayName)
	{
		t_addrNode.p = displayName;
	}
	addrNodes.push(t_addrNode);
	msgNode.su =
	{
		_content : subject
	};
	var topNode =
	{
		ct : "multipart/alternative"
	};
	msgNode.mp =
	[ topNode ];
	var partNodes = topNode.mp =
	[];

	// text part..
	var content = emailBody;
	var partNode =
	{
		ct : "text/plain"
	};
	partNode.content =
	{
		_content : content
	};
	partNodes.push(partNode);

	// html part..
	content =
	[ "<html><head><style type='text/css'>p { margin: 0; }</style></head>", "<body><div style='font-family: Times New Roman; font-size: 12pt; color: #000000'>", content,
			"</div></body></html>" ].join("");

	var partNode =
	{
		ct : "text/html"
	};
	partNode.content =
	{
		_content : content
	};
	partNodes.push(partNode);
	var callback = new AjxCallback(this, this._sendEmailCallack);
	var errCallback = new AjxCallback(this, this._sendEmailErrCallback);
	appCtxt.getAppController().sendRequest(
	{
		jsonObj : jsonObj,
		asyncMode : true,
		noBusyOverlay : true,
		errorCallback : errCallback,
		callback : callback
	});
}
