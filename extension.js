/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const RDSK_ICON_SIZE = 22;
const DEFAULT_KEYBOARD = 'en-us';
const DEFAULT_NETWORK = 'lan';

const RDesktopMenu = new Lang.Class({
    Name: 'RDesktopMenu.RDesktopMenu',
    Extends: PanelMenu.SystemStatusButton,

    _init: function() {
        this.parent('server');
        this.items = [];
        this._createItems();
        this.setName("RDP");
        this.setIcon('network-workgroup-symbolic');
    },

    destroy: function() {
        this.parent();
    },

    _createItems: function() {
        let dir = Gio.file_new_for_path(GLib.get_user_config_dir () + "/grdesktop");
        this.conf = [];
        if (dir.query_exists(null)) this._listDir(dir);

        for (let srvid = 0; srvid < this.conf.length; srvid++) {
            this.items[srvid] = new PopupMenu.PopupMenuItem(this.conf[srvid].name);
            //let icon = this.devices[srvid].iconFactory(RDSK_ICON_SIZE);
            let icon_name = this.conf[srvid].icon_name || 'computer-symbolic';
            let icon = new St.Icon({icon_size: RDSK_ICON_SIZE, 
                                    icon_name: icon_name});
            this.items[srvid].addActor(icon, { align: St.Align.END });
            this.items[srvid].conf = this.conf[srvid];
            this.menu.addMenuItem(this.items[srvid]);
            this.items[srvid].connect('activate', function(actor,event) {
                try {
                    GLib.spawn_command_line_async(actor.conf.run);
                }
                catch (err) {
                    Main.notifyError('Error', err.message);
                }
            });
        }

    },

    _getDef: function(kf, group, key, def) {
        return kf.has_key(group, key) ? kf.get_string(group, key) : def;
    },


    _getSw: function(kf, group, key, sw) {
        return kf.has_key(group, key) ? ' -' + sw + ' ' + kf.get_string(group, key) : '';
    },

    _listDir: function(file) {
        this.conf = [];
        let enumerator = file.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME,
                                      Gio.FileQueryInfoFlags.NONE, null);
	    if (enumerator == null) throw error;
	    let info;
        let re = /.*\.conf$/;
	    while ((info = enumerator.next_file(null)) != null) {
		    if (re.test(info.get_name())) {
                let kf = new GLib.KeyFile;
                // Monkey patching: gir file describes has_key, but it's not present
		        if (kf.has_key == undefined) kf.has_key = function(group, key) {
                    try {
			            let keys = kf.get_keys(group);
			            return keys[0].indexOf(key) != -1;
                    } catch (e) { return false; }
		        }
                try {
		            kf.load_from_file(file.get_path() + "/" + info.get_name(), 
                                      GLib.KeyFileFlags.NONE);
                } catch (e) {
                    global.log("Cannot load " + info.get_name() + ": " + e);
                    continue;
                }
                let name = kf.get_start_group();
                let current = { name: name };
                
                if (kf.has_key(name, 'icon_name'))
                    current.icon_name = kf.get_string(name, 'icon_name');
                if (kf.has_key(name, 'run')) 
                    current.run = kf.get_string(name, 'run');
                else {
                    let net = this._getDef(kf, name, 'network', DEFAULT_NETWORK);
                    let k = this._getSw(kf, name, 'keyboard', 'k');
                    let res = this._getSw(kf, name, 'resolution', 'g');
                    let host = this._getDef(kf, name, 'host', name);
                    let t = this._getDef(kf, name, 'title', host);
                    let user = this._getSw(kf, name, 'user', 'u');
                    let pwd = this._getSw(kf, name, 'password', 'p');
                    let domain = this._getSw(kf, name, 'domain', 'd');
                    current.run = "rdesktop -E -r clipboard:PRIMARYCLIPBOARD -0 -5 "
                     + user + pwd + domain + k + res + " -T " + t + " -x " + net + ' ' + host;
                }

                this.conf.push(current);
                // Same gir vs object problem
                if (kf.free != undefined) kf.free();
            }
        }
	}

});

function init() {
    //Convenience.initTranslations();
}

let _indicator;

function enable() {
    _indicator = new RDesktopMenu;
    global.log(_indicator);
    Main.panel._rdpindicator = _indicator;
    Main.panel.addToStatusArea('rdesktop-menu', _indicator);
}

function disable() {
    _indicator.destroy();
    Main.panel._rdpindicator = null;
}

