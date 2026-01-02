{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.semeru-bin-17
    pkgs.nodejs
    pkgs.firebase-tools
  ];

  shellHook = ''
    export JAVA_HOME=${pkgs.semeru-bin-17}
    export PATH=$JAVA_HOME/bin:$PATH
  '';
}

