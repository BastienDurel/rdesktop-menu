/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

import GLib from 'gi://GLib';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const RDSK_ICON_SIZE = 20;
const DEFAULT_NETWORK = 'lan';

export default class RDesktopMenuExtension extends Extension {
    enable() {
        console.log('enabling RDesktopMenu');
        this._indicator = new RDesktopMenu();
        Main.panel._rdpindicator = this._indicator;
        Main.panel.addToStatusArea('rdesktop-menu', this._indicator);
        console.log('RDesktopMenu enabled');
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        Main.panel._rdpindicator = null;
    }
}

const RDesktopMenuItem = GObject.registerClass(
    {
    },
    class RDesktopMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(conf) {
            super._init({style_class: 'rdesktop-menu-item'});
            console.log(`init ${conf.name}`);

            this.label = new St.Label({text: conf.name, x_expand: true});
            this.add_child(this.label);
            this.label_actor = this.label;

            this.conf = conf;

            let iconName = conf.icon_name || 'computer-symbolic';
            let icon = new St.Icon({
                iconName,
                icon_size: RDSK_ICON_SIZE,
            });
            let button = new St.Button({child: icon});
            button.connect('clicked', this._run.bind(this));
            this.connect('activate', this._run.bind(this));
            this.add_child(button);
        }

        _run() {
            try {
                console.log(`Try to run: '${this.conf.run_safe}'`);
                GLib.spawn_command_line_async(this.conf.run);
            } catch (err) {
                Main.notifyError('Error', err.message);
            }
        }
    }
);

const RDesktopMenu = GObject.registerClass(
    {
    },
    class RDesktopMenu extends PanelMenu.Button {
        _init() {
            super._init(0, 'server');
            this.items = [];
            let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box'});
            let icon = new St.Icon({
                icon_name: 'network-workgroup-symbolic',
                style_class: 'system-status-icon',
            });
            hbox.add_child(icon);
            hbox.add_child(new St.Label({
                text: '\u25BE',
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            }));
            this.add_child(hbox);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._createItems();
            this.show();
        }

        destroy() {
            super.destroy();
        }

        _createItems() {
            this.refreshButton = new PopupMenu.PopupMenuItem(_('Refresh'));
            this.refreshButton.label.x_expand = true;
            this.refreshButton.connect('activate', this.refresh.bind(this));
            let icon = new St.Icon({icon_name: 'view-refresh-symbolic', icon_size: RDSK_ICON_SIZE});
            this.refreshButton.add_child(icon);
            // this.menu.addMenuItem(this.refreshButton);
            // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            console.log('starting _createItems()');
            let dir = Gio.file_new_for_path(`${GLib.get_user_config_dir()
            }/grdesktop`);
            this.conf = [];
            if (dir.query_exists(null))
                this._listDir(dir);

            for (let srvid = 0; srvid < this.conf.length; srvid++) {
                let item = new RDesktopMenuItem(this.conf[srvid]);
                this.menu.addMenuItem(item);
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addMenuItem(this.refreshButton);
        }

        refresh() {
            this.menu.removeAll();
            this._createItems();
        }

        _getDef(kf, group, key, def) {
            return kf.has_key(group, key) ? kf.get_string(group, key) : def;
        }

        _getSw(kf, group, key, sw) {
            return kf.has_key(group, key) ? ` -${sw} "${
                kf.get_string(group, key)}"` : '';
        }

        _getBoolSw(kf, group, key, sw, def) {
            var val = kf.has_key(group, key) ? !!kf.get_int(group, key) : def;
            return val ? ` -${sw}` : '';
        }

        _getXFSw(kf, group, key, sw) {
            return kf.has_key(group, key) ? ` /${sw}:${
                kf.get_string(group, key)}` : '';
        }

        _getXFSwDef(kf, group, key, sw, def) {
            return kf.has_key(group, key) ? ` /${sw}:${
                kf.get_string(group, key)}` : ` /${sw}:${def}`;
        }

        _getFreeRdp(kf, group) {
            var key = 'freerdp';
            return kf.has_key(group, key) && kf.get_string(group, key) === '1';
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
                if (res && res.length === 2)
                    return ` /w:${res[0]} /h:${res[1]}`;
                else
                    console.log(`Cannot parse resolution: ${_res}`);
            }
            return ' /w:1275 /h:962';
        }

        _loadGroup(kf, name) {
            let current = {name};

            if (kf.has_key(name, 'icon_name'))
                current.icon_name = kf.get_string(name, 'icon_name');
            if (kf.has_key(name, 'run')) {
                current.run = kf.get_string(name, 'run');
            } else {
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
                        `xfreerdp /cert-ignore +clipboard /bpp:24 /kbd:0x00020409 /drive:tmp,/tmp ${
                            this._getXFSw(kf, name, 'sec', 'sec')
                        }${this._getXFRes(kf, name)
                        }${this._getXFSw(kf, name, 'user', 'u')
                        }${this._getXFSw(kf, name, 'password', 'p')
                        }${this._getXFSw(kf, name, 'domain', 'd')} '/t:${
                            t}' /v:${host}`;
                    current.run_safe = current.run.replace(/\/p:[^ ']+/, '/p:*****');
                } else {
                    let encryption = this._getBoolSw(kf, name, 'disable_encryption', 'E', true);
                    current.run =
                        `rdesktop -r clipboard:PRIMARYCLIPBOARD -0 -5 -r disk:tmp=/tmp${
                            encryption}${user}${pwd}${domain}${k}${res
                        } -T "${t}" -x ${net} ${extra} ${
                            host}`;
                    current.run_safe = current.run.replace(/-p "?[^ "]+"?/, '-p *****');
                }
            }

            this.conf.push(current);
        }

        _listDir(file) {
            this.conf = [];
            let enumerator = file.enumerate_children(
                Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE,
                null);
            if (enumerator == null)
                throw new Error('Missing enumerator');
            let info;
            let re = /.*\.conf$/;
            while ((info = enumerator.next_file(null)) != null) {
                if (re.test(info.get_name())) {
                    let kf = new GLib.KeyFile();
                    // Monkey patching: gir file describes has_key,
                    // but it's not present
                    if (kf.has_key === undefined) {
                        kf.has_key = function (group, key) {
                            try {
                                let keys = kf.get_keys(group);
                                return keys[0].indexOf(key) !== -1;
                            } catch (e) {
                                return false;
                            }
                        };
                    }
                    try {
                        kf.load_from_file(`${file.get_path()}/${info.get_name()}`,
                            GLib.KeyFileFlags.NONE);
                    } catch (e) {
                        console.log(`Cannot load ${info.get_name()}: ${e}`);
                        continue;
                    }
                    const groups = kf.get_groups(); // returns [[n1,nn], len]
                    groups[0].forEach(name => this._loadGroup(kf, name));

                    // Same gir vs object problem
                    if (kf.free !== undefined)
                        kf.free();
                }
            }
        }
    }
);
