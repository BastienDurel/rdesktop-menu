/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const RDSK_ICON_SIZE = 22;
const DEFAULT_KEYBOARD = 'en-us';
const DEFAULT_NETWORK = 'lan';

let _indicator;

var RDesktopMenuItem = class RDesktopMenuItem extends PopupMenu.PopupBaseMenuItem {

    constructor() { super(); }

    _init(conf) {
	      global.log('init ' + conf.name);
        super._init(conf);

	      this.label = new St.Label({ text: conf.name });
	      this.actor.add(this.label, { expand: true });
        this.actor.label_actor = this.label;

	      this.conf = conf;

        let icon_name = conf.icon_name || 'computer-symbolic';
	      let icon = new St.Icon({ icon_name: icon_name, 
	                               icon_size: RDSK_ICON_SIZE });
	      let button = new St.Button({ child: icon });
	      button.connect('clicked', Lang.bind(this, this._run));
	      this.actor.connect('button-press-event', Lang.bind(this, this._run));
	      this.actor.add(button);
    }

    _run() {
        try {
            global.log("Try to run: '" + this.conf.run + "'");
            GLib.spawn_command_line_async(this.conf.run);
        }
        catch (err) {
            Main.notifyError('Error', err.message);
        }
    }
};

var RDesktopRefreshMenuItem = class RDesktopRefreshMenuItem extends PopupMenu.PopupBaseMenuItem {

    _init(conf) {
        super._init(conf);
	      this.label = new St.Label({ text: 'Refresh' });
	      this.actor.add(this.label, { expand: true });
        this.actor.label_actor = this.label;

	      let icon = new St.Icon({ icon_name: 'view-refresh-symbolic',
	                               icon_size: RDSK_ICON_SIZE });
	      let button = new St.Button({ child: icon });
	      button.connect('clicked', Lang.bind(this, this._run));
	      this.actor.connect('button-press-event', Lang.bind(this, this._run));
	      this.actor.add(button);
    }

    _run() {
        try {
            global.log('calling refresh()');
            _indicator.refresh()
        }
        catch (err) {
            Main.notifyError('Error', err.message);
        }
    }
};


var RDesktopMenu = class RDesktopMenu extends PanelMenu.Button {

    _init() {
        super._init(0, 'server');
        this.items = [];
        let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        let icon = new St.Icon({ icon_name: 'network-workgroup-symbolic',
                                 style_class: 'system-status-icon' });
        hbox.add_child(icon);
        hbox.add_child(new St.Label({ text: '\u25BE',
                                      y_expand: true,
                                      y_align: Clutter.ActorAlign.CENTER }));
        this.actor.add_child(hbox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._createItems();
        this.actor.show();
    }

    destroy() {
        super.destroy();
    }

    _createItems() {
        global.log('starting _createItems()');
        let dir = Gio.file_new_for_path(GLib.get_user_config_dir ()
                                        + "/grdesktop");
        this.conf = [];
        if (dir.query_exists(null)) this._listDir(dir);

        for (let srvid = 0; srvid < this.conf.length; srvid++) {
	          let item = new RDesktopMenuItem(this.conf[srvid]);
	          this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new RDesktopRefreshMenuItem());
    }

    refresh() {
        this.menu.removeAll();
        this._createItems();
    }

    _getDef(kf, group, key, def) {
        return kf.has_key(group, key) ? kf.get_string(group, key) : def;
    }

    _getSw(kf, group, key, sw) {
        return kf.has_key(group, key) ? ' -' + sw + ' ' +
            kf.get_string(group, key) : '';
    }

    _getXFSw(kf, group, key, sw) {
        return kf.has_key(group, key) ? ' /' + sw + ':' +
            kf.get_string(group, key) : '';
    }
    
    _getFreeRdp(kf, group) {
        var key = 'freerdp';
        return kf.has_key(group, key) && kf.get_string(group, key) == '1';
    }

    _getExtra(kf, group) {
        var key = 'extra';
        return kf.has_key(group, key) ? kf.get_string(group, key) : '';
    }

    _getXFRes(kf, group) {
        var key = 'resolution';
        if (kf.has_key(group, key)) {
            var _res = kf.get_string(group, key);
            var res = _res.split('x');
            if (res && res.length == 2)
                return ' /w:' + res[0] + ' /h:' + res[1];
            else
                global.log('Cannot parse resolution: ' + _res);
        }
        return ' /w:1275 /h:962';
    }

    _listDir(file) {
        this.conf = [];
        let enumerator = file.enumerate_children(
            Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE,
            null);
	      if (enumerator == null) throw error;
	      let info;
        let re = /.*\.conf$/;
	      while ((info = enumerator.next_file(null)) != null) {
		        if (re.test(info.get_name())) {
                let kf = new GLib.KeyFile;
                // Monkey patching: gir file describes has_key,
                // but it's not present
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
                let name0 = kf.get_start_group();
                let current = { "name": name0 };

                if (kf.has_key(name0, 'icon_name'))
                    current.icon_name = kf.get_string(name0, 'icon_name');
                if (kf.has_key(name0, 'run')) 
                    current.run = kf.get_string(name0, 'run');
                else {
                    let net = this._getDef(kf, name0, 'network',
                                           DEFAULT_NETWORK);
                    let k = this._getSw(kf, name0, 'keyboard', 'k');
                    let res = this._getSw(kf, name0, 'resolution', 'g');
                    let host = this._getDef(kf, name0, 'host', name0);
                    let t = this._getDef(kf, name0, 'title', host);
                    let user = this._getSw(kf, name0, 'user', 'u');
                    let pwd = this._getSw(kf, name0, 'password', 'p');
                    let domain = this._getSw(kf, name0, 'domain', 'd');
                    let extra = this._getExtra(kf, name0);
                    let freerdp = this._getFreeRdp(kf, name0);
                    if (freerdp) {
                        current.run =
                            "xfreerdp /cert-ignore /sec:rdp +clipboard /bpp:24 /kbd:0x00020409 /drive:tmp,/tmp "
                            + this._getXFRes(kf, name0)
                            + this._getXFSw(kf, name0, 'user', 'u')
                            + this._getXFSw(kf, name0, 'password', 'p') 
                            + this._getXFSw(kf, name0, 'domain', 'd') + " '/t:"
                            + t + "' /v:" + host;
                    }
                    else {
                        current.run =
                            "rdesktop -E -r clipboard:PRIMARYCLIPBOARD -0 -5 -r disk:tmp=/tmp "
                            + user + pwd + domain + k + res + " -T '" + t
                            + "' -x " + net + ' ' + extra + ' ' + host;
                    }
                }

                this.conf.push(current);
                // Same gir vs object problem
                if (kf.free != undefined) kf.free();
            }
        }
	}

};

function init() {
    //Convenience.initTranslations();
}

function enable() {
    _indicator = new RDesktopMenu();
    global.log(_indicator);
    Main.panel._rdpindicator = _indicator;
    Main.panel.addToStatusArea('rdesktop-menu', _indicator);
    global.log("RDesktopMenu enabled");
}

function disable() {
    _indicator.destroy();
    Main.panel._rdpindicator = null;
}

/**
 * Re-wrap the Indicator class as a GObject subclass for GNOME Shell 3.32
 */
if (true) {
    RDesktopMenu = GObject.registerClass(
        {GTypeName: 'RDesktopMenuIndicator'},
        RDesktopMenu
    );
}
