import { h, render, createContext } from 'preact';
import { useState, useEffect, useContext, useMemo, useRef } from 'preact/hooks';
import htm from 'htm';

export const html = htm.bind(h);
export { h, render, createContext, useState, useEffect, useContext, useMemo, useRef };
