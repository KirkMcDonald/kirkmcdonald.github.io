/*Copyright 2015-2024 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

class ColorScheme {
    constructor(name, key, scheme) {
        this.name = name
        this.key = key
        this.scheme = scheme
    }
    apply() {
        let html = document.documentElement
        for (let [name, value] of this.scheme) {
            html.style.setProperty(name, value)
        }
    }
}

export let colorSchemes = [
    new ColorScheme(
        "Default",
        "default",
        new Map([
            ["--dark", "#171717"],
            ["--dark-overlay", "rgba(23, 23, 23, 0.8)"],
            ["--medium", "#212427"],
            ["--main", "#272b30"],
            ["--light", "#3a3f44"],
            ["--foreground", "#c8c8c8"],
            ["--accent", "#ff7200"],
            ["--bright", "#f1fff2"],
        ])
    ),
    new ColorScheme(
        "Printer-friendly",
        "printer",
        new Map([
            ["--dark", "#f0f0f0"],
            ["--dark-overlay", "#ffffff"],
            ["--medium", "#ffffff"],
            ["--main", "#ffffff"],
            ["--light", "#dddddd"],
            ["--foreground", "#000000"],
            ["--accent", "#222222"],
            ["--bright", "#111111"],
        ])
    )
]
