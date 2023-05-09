rdesktop-menu extension for GNOME SHELL (c) 2012-2021 Bastien Durel

Add a servers status menu for quickly running rdesktop.

It uses ini files located into ~/.config/grdesktop/

This software is released under the GNU Public License.

[![pipeline status](https://git.geekwu.org/bastien/rdesktop-menu/badges/master/pipeline.svg)](https://git.geekwu.org/bastien/rdesktop-menu/commits/master)

## To bootstrap the extension

```sh
$ mkdir -p ~/.config/grdesktop/
$ cp ~/.local/share/gnome-shell/extensions/rdesktop-menu@bastien.git.geekwu.org/example.conf ~/.config/grdesktop/myhost.conf
$ $EDITOR ~/.config/grdesktop/myhost.conf
```

...then refresh config from the extension GUI.

You can have any number of connection files in config directory, but make sure
they have a different name ("`[example-connection]`" is the name in
template), or they would merge in menu
