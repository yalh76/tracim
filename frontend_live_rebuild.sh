#!/usr/bin/env bash

skip_initial_build=""
skip_install=""
disable_notification=""

declare -a children_pid
declare -A original_webpack_config

help() {
    cat <<'EOF'
Recompiles Tracim frontend components as they are modified.
Also runs yarn install and recompile the Tracim frontend vendors in development
mode.

Usage: $1 [options]

--skip-initial-build
    Do not run yarn install nor first compile the full frontend

--skip-install
    Do not run yarn install

--disable-notifications
    Do not use notify-send to display messages
EOF
}

check_requirements () {
    if ! which notify-send > /dev/null && [ -z "$disable_notification" ]; then
        cat <<EOF

* WARNING: notify-send is missing. On debian: sudo apt install ruby-notify
*          Notifications will be disabled.
*          To remove this warning, use --disable-notifications

EOF
        disable_notification=y
    fi

    if ! which inotifywait > /dev/null; then
        exec cat > /dev/stderr <<EOF
ERROR: inotifywait is missing. On debian: sudo apt install inotify-tools
EOF
    fi
}

show_msg () {
    msg="$1"
    if [ -z "$disable_notification" ]; then
        notify-send "$msg"
    fi
    printf "%s\n" "$msg"
}

ok () {
    show_msg "☺ Recompiled $1!"
}

err () {
    show_msg "☹ Failed to recompile $1!"
}

quit () {
    echo "Cleaning up…"
    restore_optimized_webpack_configs
    for pid in "${children_pid[@]}"; do
        kill $pid 2>/dev/null # Fails for the child that receives CTRL+C
    done
}

list_modified_paths () {
    # returns the path of the file that has been changed
    inotifywait -m -q -r -e "close_write,modify,create,move,moved_from,moved_to,delete" \
        "src" \
        "package.json" \
        "webpack.config.js"
}

patch_optimized_webpack_config () {
    # disables linting and targets recent versions of chrome and firefox to
    # avoid heavy transformations that are slow to compile and make it harder to
    # debug
    component="$1"
    cd "$TRACIM_DIR/$component"
    original_webpack_config["$component"]="$(cat webpack.config.js)"
    echo 'module.exports.module.rules[0] = {}' >> webpack.config.js
    sed -i -E "s| '@babel/preset-env',| \\['@babel/preset-env', \\{ targets: \\{ firefox: 83, chrome: 86 \\}  \\} \\],|g" webpack.config.js
}

patch_optimized_webpack_configs () {
    cd "$TRACIM_DIR"
    for i in frontend frontend_*; do
        if [ -d "$i" ]; then
            patch_optimized_webpack_config "$i"
        fi
    done
}

restore_optimized_webpack_config () {
    component="$1"
    cd "$TRACIM_DIR/$component"
    if [ -n "${original_webpack_config["$component"]}" ]; then
        printf "%s\n" "${original_webpack_config["$component"]}" > webpack.config.js
        patch_optimized_webpack_config["$component"]=''
    fi
}

restore_optimized_webpack_configs () {
    cd "$TRACIM_DIR"
    for i in frontend frontend_*; do
        if [ -d "$i" ]; then
            restore_optimized_webpack_config "$i"
        fi
    done
}

watch_frontend_component () {
    component="$1"
    echo watching $component
    cd "$TRACIM_DIR/$component"
    while true; do
        list_modified_paths | while read line; do
            modified_filename="$(echo "$line" | cut -d' ' -f3)"
            if ! [[ "$modified_filename" == .* ]]; then
                echo "Modified file: $modified_filename"
                show_msg "Recompiling $component..."
                patch_optimized_webpack_config "$component"
                if [ -f ./build_*.sh ]; then
                    ./build_*.sh -d && ok "$component" || err "$component"
                else
                    yarn buildoptimized-dev && ok "$component" || err "$component"
                fi
                restore_optimized_webpack_config "$component"
#                 exec 0<&-
                break
            fi
        done
    done
}

cd_to_root() {
    if [ -z "$TRACIM_DIR" ]; then
        while [ ! -d '.git' ]; do
            cd ..
        done

        TRACIM_DIR="$PWD"
    fi
}

handle_args () {
    while [ "$#" != "0" ]; do
        case "$1" in
            "--skip-initial-build")
                skip_initial_build="y"
            ;;

            "--skip-install")
                skip_install="y"
            ;;

            "--disable-notifications")
                disable_notification="y"
            ;;

            "help"|"-help"|"--help"|"-h")
                help "$0"
                exit
            ;;

            *)
                &>2 echo "Unrecognized parameter $1."
                help
                exit 1
            ;;
        esac
        shift
    done
}

watch_frontend_components () {
    echo "Watching modifications in each frontend component..."
    cd "$TRACIM_DIR"
    for i in frontend frontend_*; do
        if [ -d "$i" ]; then
            watch_frontend_component "$i" &
            children_pid+=($!)
        fi
    done

    cd "$TRACIM_DIR"
    for i in frontend frontend_*; do
        if [ -d "$i" ]; then
            wait
        fi
    done
}

build_vendors () {
    echo 'Rebuilding vendors in development mode:'
    cd frontend_vendors
    ./build_vendors.sh -d
}

build_full_frontend () {
    cd "$TRACIM_DIR"
    git show origin/parallelized_frontend_build:build_full_frontend.sh | bash -s - -d
}

initial_build () {
    if [ -z "$skip_initial_build" ]; then
        [ -z "$skip_install" ] && yarn install
        patch_optimized_webpack_configs
        build_full_frontend || exit 1
        build_vendors || exit 1
        restore_optimized_webpack_configs
    fi
}

main () {
    handle_args "$@"
    trap quit SIGINT SIGQUIT SIGTSTP
    check_requirements
    cd_to_root
    initial_build
    watch_frontend_components
}

main "$@"
