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
const Config = imports.misc.config;
const Me = ExtensionUtils.getCurrentExtension();

const RDSK_ICON_SIZE = 22;
const DEFAULT_KEYBOARD = 'en-us';
const DEFAULT_NETWORK = 'lan';

let _indicator;
window.rdesktopmenu = {
    extdatadir: ExtensionUtils.getCurrentExtension().path,
    shell_version: parseInt(Config.PACKAGE_VERSION.split('.')[1], 10)
};

var RDesktopMenuItem = class RDesktopMenuItem extends PopupMenu.PopupBaseMenuItem {

    _init(conf) {
        super._init();
        global.log('init ' + conf.name);

        this.label = new St.Label({ text: conf.name, x_expand: true });
        this.add_child(this.label);
        this.label_actor = this.label;

        this.conf = conf;

        let icon_name = conf.icon_name || 'computer-symbolic';
        let icon = new St.Icon({ icon_name: icon_name,
                                 icon_size: RDSK_ICON_SIZE });
        let button = new St.Button({ child: icon });
        button.connect('clicked', () => { this._run(); });
        this.connect('button-press-event', () => { this._run(); });
        this.add_child(button);
    }

    _run() {
        try {
            global.log("Try to run: '" + this.conf.run_safe + "'");
            GLib.spawn_command_line_async(this.conf.run);
        }
        catch (err) {
            Main.notifyError('Error', err.message);
        }
    }
};

var RDesktopRefreshMenuItem = class RDesktopRefreshMenuItem extends PopupMenu.PopupBaseMenuItem {

    _init(conf) {
        super._init();
        this.label = new St.Label({ text: 'Refresh', x_expand: true });
        this.add_child(this.label);
        this.label_actor = this.label;

        let icon = new St.Icon({ icon_name: 'view-refresh-symbolic',
                                 icon_size: RDSK_ICON_SIZE });
        let button = new St.Button({ child: icon });
        button.connect('clicked', () => { this._run(); });
        this.connect('button-press-event', () => { this._run(); });
        this.add_child(button);
    }

    _run() {
        try {
            global.log('calling refresh()');
            _indicator.refresh();
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
        this.add_child(hbox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._createItems();
        this.show();
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
        return kf.has_key(group, key) ? ' -' + sw + ' "' +
            kf.get_string(group, key) + '"' : '';
    }

    _getBoolSw(kf, group, key, sw, def) {
        var val = kf.has_key(group, key) ? !!kf.get_int(group, key) : def;
        return val ? ' -' + sw : '';
    }

    _getXFSw(kf, group, key, sw) {
        return kf.has_key(group, key) ? ' /' + sw + ':' +
            kf.get_string(group, key) : '';
    }

    _getXFSwDef(kf, group, key, sw, def) {
        return kf.has_key(group, key) ? ' /' + sw + ':' +
            kf.get_string(group, key) : ' /' + sw + ':' + def;
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
                if (kf.has_key == undefined)
                    kf.has_key = function(group, key) {
                        try {
                            let keys = kf.get_keys(group);
                            return keys[0].indexOf(key) != -1;
                        } catch (e) { return false; }
                    };
                try {
                    kf.load_from_file(file.get_path() + "/" + info.get_name(),
                                      GLib.KeyFileFlags.NONE);
                } catch (e) {
                    global.log("Cannot load " + info.get_name() + ": " + e);
                    continue;
                }
                let name = kf.get_start_group();
                let current = { "name": name };

                if (kf.has_key(name, 'icon_name'))
                    current.icon_name = kf.get_string(name, 'icon_name');
                if (kf.has_key(name, 'run'))
                    current.run = kf.get_string(name, 'run');
                else {
                    let net = this._getDef(kf, name, 'network',
                                           DEFAULT_NETWORK);
                    let k = this._getSw(kf, name, 'keyboard', 'k');
                    let res = this._getSw(kf, name, 'resolution', 'g');
                    let host = this._getDef(kf, name, 'host', name);
                    let t = this._getDef(kf, name, 'title', host);
                    let user = this._getSw(kf, name, 'user', 'u');
                    let pwd = this._getSw(kf, name, 'password', 'p');
                    let domain = this._getSw(kf, name, 'domain', 'd');
                    let extra = this._getExtra(kf, name);
                    let freerdp = this._getFreeRdp(kf, name);
                    if (freerdp) {
                        current.run =
                            "xfreerdp /cert-ignore +clipboard /bpp:24 /kbd:0x00020409 /drive:tmp,/tmp "
                            + this._getXFSwDef(kf, name, 'sec', 'sec')
                            + this._getXFRes(kf, name)
                            + this._getXFSw(kf, name, 'user', 'u')
                            + this._getXFSw(kf, name, 'password', 'p')
                            + this._getXFSw(kf, name, 'domain', 'd') + " '/t:"
                            + t + "' /v:" + host;
                        current.run_safe = current.run.replace(/\/p:[^ ']+/, '/p:*****');
                    }
                    else {
                        let encryption = this._getBoolSw(kf, name, 'disable_encryption', 'E', true);
                        current.run =
                            "rdesktop -r clipboard:PRIMARYCLIPBOARD -0 -5 -r disk:tmp=/tmp"
                            + encryption + user + pwd + domain + k + res
                            + ' -T "' + t + '" -x ' + net + ' ' + extra + ' '
                            + host;
                        current.run_safe = current.run.replace(/-p "?[^ "]+"?/, '-p *****');
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
global.log("Re-wrap classes");
RDesktopMenu = GObject.registerClass(
    {GTypeName: 'RDesktopMenuIndicator'},
    RDesktopMenu
);
/**
 * Re-wrap the MenuItem classes as a GObject subclasses for GNOME Shell 3.34
 */
RDesktopMenuItem = GObject.registerClass(
    {GTypeName: 'RDesktopMenuItemIndicator'},
    RDesktopMenuItem
);
RDesktopRefreshMenuItem = GObject.registerClass(
    {GTypeName: 'RDesktopRefreshMenuItemIndicator'},
    RDesktopRefreshMenuItem
);
